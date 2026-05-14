import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { claude } from "../../../core/lib/claude.ts";
import { listNotes } from "../../../core/lib/vault.ts";
import { CLI_DIR, stagingDir } from "./paths.ts";
import { listLegacySessionSources, listBuildJournalSources, type NuggetSource } from "./sources.ts";
import { jaccard } from "./dedup.ts";

const HAIKU = "claude-haiku-4-5-20251001";
const SOURCE_BODY_LIMIT = 6_000;
const DEDUP_THRESHOLD = 0.55;

export interface Candidate {
  title: string;
  pillar: string;
  tier: 1 | 2 | 3;
  content_ready: boolean;
  tags: string[];
  aliases?: string[];
  summary: string;
  body: string;
  related?: string[];
  sourceId: string;
  sourcePath: string;
}

export interface ExtractResult {
  candidates: Candidate[];
  dropped: Array<{ title: string; reason: string; pillar?: string }>;
  scanned: number;
}

interface ExtractCheckpoint {
  lastRunAt: number;
}

async function readCheckpoint(taskOutputDir: string): Promise<ExtractCheckpoint> {
  // Single global checkpoint at vault/.staging/.checkpoint.json — shared across tasks.
  const file = path.join(path.dirname(taskOutputDir), ".checkpoint.json");
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as ExtractCheckpoint;
  } catch {
    return { lastRunAt: 0 };
  }
}

async function writeCheckpoint(taskOutputDir: string, ck: ExtractCheckpoint): Promise<void> {
  const file = path.join(path.dirname(taskOutputDir), ".checkpoint.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(ck, null, 2), "utf-8");
}

function parsePromptCorpus(raw: string): string {
  // The prompt file may include preamble markdown. Use the whole file as the system prompt.
  return raw.trim();
}

async function scanOneSource(prompt: string, src: NuggetSource): Promise<Candidate[]> {
  const excerpt = src.raw.length > SOURCE_BODY_LIMIT ? src.raw.slice(0, SOURCE_BODY_LIMIT) + "\n…(truncated)" : src.raw;
  const fullPrompt = `${prompt}

---

Source kind: ${src.kind}
Source id: ${src.id}

${excerpt}

Return JSON array now.`;
  const result = await claude(fullPrompt, HAIKU);
  const trimmed = result.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  if (!trimmed || trimmed === "[]" || trimmed === "null") return [];
  try {
    const arr = JSON.parse(trimmed) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => typeof c.title === "string" && typeof c.pillar === "string" && typeof c.body === "string")
      .map((c) => ({
        title: String(c.title),
        pillar: String(c.pillar),
        tier: (c.tier === 1 || c.tier === 2 || c.tier === 3 ? c.tier : 2) as 1 | 2 | 3,
        content_ready: c.content_ready === true,
        tags: Array.isArray(c.tags) ? (c.tags as string[]).map(String) : [],
        aliases: Array.isArray(c.aliases) ? (c.aliases as string[]).map(String) : [],
        summary: typeof c.summary === "string" ? c.summary : "",
        body: String(c.body),
        related: Array.isArray(c.related) ? (c.related as string[]).map(String) : [],
        sourceId: src.id,
        sourcePath: src.path,
      }));
  } catch {
    return [];
  }
}

export async function runExtract(taskId: string, outputDir: string): Promise<ExtractResult> {
  await fs.mkdir(stagingDir(taskId), { recursive: true });
  const ck = await readCheckpoint(stagingDir(taskId));

  const [legacy, journal] = await Promise.all([
    listLegacySessionSources(ck.lastRunAt),
    listBuildJournalSources(ck.lastRunAt),
  ]);
  const sources = [...legacy, ...journal];
  if (sources.length === 0) {
    await writeCheckpoint(stagingDir(taskId), { lastRunAt: Date.now() });
    return { candidates: [], dropped: [], scanned: 0 };
  }

  const promptRaw = await fs.readFile(path.join(CLI_DIR, "extract.md"), "utf-8").catch(() => "");
  const prompt = parsePromptCorpus(promptRaw);

  const allCandidates: Candidate[] = [];
  for (const src of sources) {
    const cands = await scanOneSource(prompt, src).catch(() => []);
    allCandidates.push(...cands);
  }

  // Dedup against live vault
  const liveNotes = await listNotes();
  const liveSummaries = liveNotes
    .filter((n) => n.filename.toLowerCase() !== "map of content")
    .map((n) => ({ filename: n.filename, summary: (n.frontmatter.title as string) ?? n.summary }));

  const survivors: Candidate[] = [];
  const dropped: ExtractResult["dropped"] = [];
  for (const c of allCandidates) {
    const text = `${c.title} ${c.summary}`;
    const match = liveSummaries.find((n) => jaccard(text, `${n.filename} ${n.summary}`) >= DEDUP_THRESHOLD);
    if (match) {
      dropped.push({ title: c.title, reason: `duplicate of vault note "${match.filename}"`, pillar: c.pillar });
    } else {
      survivors.push(c);
    }
  }

  // Also dedup survivors against each other (claude can produce near-duplicates across sources)
  const final: Candidate[] = [];
  for (const c of survivors) {
    const text = `${c.title} ${c.summary}`;
    const dupe = final.find((other) => jaccard(text, `${other.title} ${other.summary}`) >= DEDUP_THRESHOLD);
    if (dupe) {
      dropped.push({ title: c.title, reason: `duplicate of staged candidate "${dupe.title}"`, pillar: c.pillar });
    } else {
      final.push(c);
    }
  }

  // Stage to disk
  const stage = stagingDir(taskId);
  await fs.mkdir(stage, { recursive: true });
  await Promise.all(
    final.map((c, i) => {
      const slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const fname = `${String(i + 1).padStart(2, "0")}-${slug || `candidate-${i}`}.json`;
      return fs.writeFile(path.join(stage, fname), JSON.stringify(c, null, 2), "utf-8");
    }),
  );
  await fs.writeFile(path.join(stage, "dropped.json"), JSON.stringify(dropped, null, 2), "utf-8");
  await fs.writeFile(path.join(stage, "scanned.json"), JSON.stringify({ sources: sources.map((s) => ({ id: s.id, path: s.path })) }, null, 2), "utf-8");

  await writeCheckpoint(stage, { lastRunAt: Date.now() });

  // Mirror summary to phase output dir
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "summary.md"),
    `# Extract\n\nScanned ${sources.length} source(s).\n\nStaged ${final.length} candidate(s).\nDropped ${dropped.length} via dedup.\n\nStaging dir: \`${stage}\`\n`,
    "utf-8",
  );

  return { candidates: final, dropped, scanned: sources.length };
}

export async function listStagedCandidates(taskId: string): Promise<Array<{ file: string; candidate: Candidate; status?: string }>> {
  const stage = stagingDir(taskId);
  const files = await fs.readdir(stage).catch(() => [] as string[]);
  const out: Array<{ file: string; candidate: Candidate; status?: string }> = [];
  for (const f of files) {
    if (!f.endsWith(".json") || f === "dropped.json" || f === "scanned.json" || f === "decisions.json") continue;
    const raw = await fs.readFile(path.join(stage, f), "utf-8").catch(() => "");
    if (!raw) continue;
    try {
      const candidate = JSON.parse(raw) as Candidate;
      out.push({ file: f, candidate });
    } catch {
      // skip malformed
    }
  }
  // Load decisions if present
  const decisionsRaw = await fs.readFile(path.join(stage, "decisions.json"), "utf-8").catch(() => "");
  if (decisionsRaw) {
    try {
      const decisions = JSON.parse(decisionsRaw) as Record<string, string>;
      for (const item of out) item.status = decisions[item.file];
    } catch {
      // skip
    }
  }
  return out;
}

export async function recordCandidateDecision(taskId: string, file: string, status: "approved" | "rejected"): Promise<void> {
  const stage = stagingDir(taskId);
  const decisionsPath = path.join(stage, "decisions.json");
  let decisions: Record<string, string> = {};
  try {
    decisions = JSON.parse(await fs.readFile(decisionsPath, "utf-8"));
  } catch {
    // empty
  }
  decisions[file] = status;
  await fs.writeFile(decisionsPath, JSON.stringify(decisions, null, 2), "utf-8");
}

export function candidateToMarkdown(c: Candidate): string {
  const fm: Record<string, unknown> = {
    pillar: c.pillar,
    title: c.title,
    tier: c.tier,
    content_ready: c.content_ready,
    created: new Date().toISOString().slice(0, 10),
    tags: c.tags,
  };
  if (c.aliases && c.aliases.length > 0) fm.aliases = c.aliases;
  const fmYaml = yaml.dump(fm, { lineWidth: 120 }).trim();
  const related = (c.related ?? []).filter((r) => r && r.trim());
  const relatedBlock = related.length > 0 ? `\n\n## Related\n\n${related.map((r) => `- [[${r}]]`).join("\n")}\n` : "";
  return `---\n${fmYaml}\n---\n\n${c.summary ? c.summary + "\n\n" : ""}${c.body.trim()}\n${relatedBlock}`;
}
