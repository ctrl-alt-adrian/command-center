import fs from "fs/promises";
import path from "path";
import { CLI_DIR, DRAFTS_DIR } from "./paths.ts";
import { SLUG_MAX_LENGTH } from "./constants.ts";
import { getPlatformConfig } from "./config.ts";
import { parseJsonArray, extractPromptFromMarkdown } from "./utils.ts";
import { claude } from "../../../core/lib/claude.ts";
import { logError } from "./errors.ts";
import { loadWritePrompt } from "./writePrompt.ts";
import { getLatestSignals, summarizeSignals } from "./signals.ts";
import { checkDuplicates, type DedupResult } from "./dedup.ts";
import { scoreCandidates } from "./scoring.ts";
import { writeKBAnalysis } from "./kb.ts";
import type { KBEntry } from "./types.ts";
import type { ScoredCandidate, DiscoverySummary, SignalSnapshot } from "./types.ts";

export interface ContentCandidate {
  id: string;
  type: "technical" | "marketing";
  hook: string;
  angle: string;
  tags: string[];
}

interface DiscoverResult {
  candidates: ScoredCandidate[];
  summary: DiscoverySummary;
}

const KB_SCANNER_BODY_LIMIT = 600;
const HAIKU = "claude-haiku-4-5-20251001";

// --- Subagent 1: KB Scanner (per-entry Haiku calls, parallel) ---
async function scanOneEntry(
  corePrompt: string,
  entry: KBEntry
): Promise<ContentCandidate | null> {
  const meta = [
    `summary: ${entry.summary || "(none)"}`,
    `contentAngles: [${(entry.contentAngles || []).join(", ")}]`,
    `shareworthy: ${entry.shareworthy}`,
    `tags: [${(entry.tags || []).join(", ")}]`,
  ].join("\n");
  const excerpt =
    entry.body.length > KB_SCANNER_BODY_LIMIT
      ? entry.body.slice(0, KB_SCANNER_BODY_LIMIT) + "…"
      : entry.body;

  const result = await claude(
    `${corePrompt}

Knowledge base entry:
--- ${entry.filename} ---
${meta}

${excerpt}

If this entry is content-worthy, respond with a single JSON object. If not, respond with null.`,
    HAIKU
  );

  const trimmed = result.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
  if (trimmed === "null" || trimmed === "[]") return null;

  try {
    const item = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      id: (item.id as string) || entry.id,
      type: (item.type as "technical" | "marketing") || "technical",
      hook: (item.hook as string) || "",
      angle: (item.angle as string) || "",
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
    };
  } catch {
    return null;
  }
}

async function runKBScanner(entries: KBEntry[]): Promise<ContentCandidate[]> {
  const scannerPrompt = await fs
    .readFile(path.join(CLI_DIR, "kb-scanner.md"), "utf-8")
    .catch(() => "");
  const corePrompt = extractPromptFromMarkdown(scannerPrompt);

  const results = await Promise.all(
    entries.map((entry) => scanOneEntry(corePrompt, entry).catch(() => null))
  );

  return results.filter((r): r is ContentCandidate => r !== null);
}

// --- Subagent 2: Signal Analyzer (Haiku) ---
async function runSignalAnalyzer(
  candidates: ContentCandidate[],
  signals: SignalSnapshot | null
): Promise<{ signalCandidates: ContentCandidate[]; signalsUsed: number }> {
  if (!signals || signals.signals.length === 0) {
    return { signalCandidates: [], signalsUsed: 0 };
  }

  const analyzerPrompt = await fs
    .readFile(path.join(CLI_DIR, "signal-analyzer.md"), "utf-8")
    .catch(() => "");
  const corePrompt = extractPromptFromMarkdown(analyzerPrompt);

  const signalSummary = summarizeSignals(signals);

  const candidateList = candidates
    .map(
      (c) =>
        `- ID: ${c.id}, Type: ${c.type}, Hook: ${c.hook}, Angle: ${c.angle}`
    )
    .join("\n");

  const result = await claude(
    `${corePrompt}

CANDIDATE TOPICS:
${candidateList}

EXTERNAL SIGNALS:
${signalSummary}

Respond ONLY with a JSON array (no other text). If no signals are relevant, return [].`,
    HAIKU
  );

  const parsed = parseJsonArray(result) as Array<Record<string, unknown>>;

  // Extract new signal-inspired candidates
  const newCandidates = parsed
    .filter((item) => typeof item.id === "string" && item.id.startsWith("signal-"))
    .map((item) => ({
      id: item.id as string,
      type: (item.type as "technical" | "marketing") || "technical",
      hook: (item.hook as string) || "",
      angle: (item.angle as string) || "",
      tags: (item.tags as string[]) || [],
    }));

  return { signalCandidates: newCandidates, signalsUsed: signals.signals.length };
}

// --- Signal matching + dedup + scoring (reusable by both paths) ---
export async function discoverFromCandidates(
  candidates: ContentCandidate[],
  entryCount: number,
  shareworthyCount: number
): Promise<DiscoverResult> {
  const signals = await getLatestSignals();

  if (candidates.length === 0) {
    return {
      candidates: [],
      summary: {
        totalEntries: entryCount,
        scannedEntries: entryCount,
        shareworthyCount,
        candidatesFound: 0,
        signalsUsed: 0,
        duplicatesFiltered: 0,
      },
    };
  }

  const signalResult = await runSignalAnalyzer(candidates, signals);

  const allCandidates = [...candidates, ...signalResult.signalCandidates];
  const dedupResults: DedupResult[] = await checkDuplicates(allCandidates);
  const survivorResults = dedupResults.filter((r) => !r.isDuplicate);
  const survivors = survivorResults.map((r) => r.candidate);
  const scored = scoreCandidates(survivors, survivorResults, signals);

  return {
    candidates: scored,
    summary: {
      totalEntries: entryCount,
      scannedEntries: entryCount,
      shareworthyCount,
      candidatesFound: scored.length,
      signalsUsed: signalResult.signalsUsed,
      duplicatesFiltered: dedupResults.length - survivors.length,
    },
  };
}

// --- Main Discovery (KB Scanner + persist + signal/dedup/scoring) ---
export async function discoverContent(
  entries: KBEntry[]
): Promise<DiscoverResult> {
  // Phase 1: Run KB Scanner
  const kbCandidates = await runKBScanner(entries);

  // Persist analysis results back to KB frontmatter
  const candidateMap = new Map(kbCandidates.map((c) => [c.id, c]));
  await Promise.all(
    entries.map((entry) => {
      const candidate = candidateMap.get(entry.id);
      return writeKBAnalysis(entry.id, candidate
        ? { contentWorthy: true, contentType: candidate.type, hook: candidate.hook, angle: candidate.angle }
        : { contentWorthy: false }
      );
    })
  );

  // Phase 2+3: Signal matching, dedup, scoring
  return discoverFromCandidates(
    kbCandidates,
    entries.length,
    entries.filter((e) => e.shareworthy).length
  );
}

export interface DraftContext {
  angle?: string;
  insight?: string;
  painPoint?: string;
  tags?: string[];
}

const SHORT_FORM_PLATFORMS = new Set(["x", "instagram", "facebook"]);

export async function generateDrafts(
  topic: string,
  kbContext: string,
  context?: DraftContext,
  existingDir?: string
): Promise<{ date: string; platforms: Record<string, string> }> {
  const { enabled: enabledPlatforms } = await getPlatformConfig();
  if (enabledPlatforms.length === 0) {
    throw new Error("No platforms enabled — enable at least one in /platforms");
  }

  const today = new Date().toISOString().slice(0, 10);
  let dirName: string;
  if (existingDir) {
    dirName = existingDir;
  } else {
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/-$/, "");
    const uid = Date.now().toString(36).slice(-4);
    dirName = `${today}_${slug}-${uid}`;
  }
  const draftDir = path.join(DRAFTS_DIR, dirName);
  await fs.mkdir(draftDir, { recursive: true });

  // On slop retry, clean up .md files and status entries for now-disabled platforms
  if (existingDir) {
    const enabledSet = new Set<string>(enabledPlatforms);
    const files = await fs.readdir(draftDir);
    const stale = files.filter(
      (f) => f.endsWith(".md") && !enabledSet.has(f.replace(/\.md$/, ""))
    );
    await Promise.all(stale.map((f) => fs.unlink(path.join(draftDir, f))));
  }

  // Generate all platform drafts in parallel. Settled so one slow/failed
  // platform doesn't kill drafts that already succeeded.
  const settled = await Promise.allSettled(
    enabledPlatforms.map(async (platform) => {
      const platformPrompt = await loadWritePrompt(platform);

      const prompt = `You are writing a ${platform} post for Adrian, founder of rolenext (an interview prep platform).

Topic/angle: ${topic}

${kbContext ? `Relevant knowledge base context:\n${kbContext}\n` : "No specific session data found for this topic. Write based on the topic alone, drawing on general knowledge of the subject."}

${platformPrompt}

Write ONLY the post content. No commentary, no labels, no markdown code blocks.`;

      const model = SHORT_FORM_PLATFORMS.has(platform) ? HAIKU : undefined;
      const content = await claude(prompt, model);
      await fs.writeFile(path.join(draftDir, `${platform}.md`), content, "utf-8");
      return [platform, content] as const;
    })
  );

  const failed: string[] = [];
  const results: Array<readonly [string, string]> = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      const platform = enabledPlatforms[i];
      await logError(`worker:generate:${platform}`, result.reason, { stage: "generate" });
      failed.push(platform);
    }
  }

  if (results.length === 0) {
    throw new Error(`All platforms failed: ${failed.join(", ")}`);
  }

  const platforms: Record<string, string> = {};
  for (const [platform, content] of results) {
    platforms[platform] = content;
  }

  // Write status.json and meta.json in parallel
  const statuses: Record<string, string> = {};
  for (const p of Object.keys(platforms)) statuses[p] = "draft";

  await Promise.all([
    fs.writeFile(
      path.join(draftDir, "status.json"),
      JSON.stringify(statuses, null, 2),
      "utf-8"
    ),
    fs.writeFile(
      path.join(draftDir, "meta.json"),
      JSON.stringify({
        title: topic,
        date: today,
        angle: context?.angle,
        insight: context?.insight,
        painPoint: context?.painPoint,
        tags: context?.tags,
        kbContext: kbContext || undefined,
      }, null, 2),
      "utf-8"
    ),
  ]);

  return { date: dirName, platforms };
}
