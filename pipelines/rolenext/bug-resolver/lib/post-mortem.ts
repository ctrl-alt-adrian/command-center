import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { claude } from "../../../../core/lib/claude.ts";
import type { InvestigateOutcome } from "./investigate-agent.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPT_PATH = path.resolve(__dirname, "..", "prompts", "post-mortem.md");
const POST_MORTEM_TIMEOUT_MS = 3 * 60_000;

export const ROOT_CAUSE_TAXONOMY = [
  "missing-null-check",
  "off-by-one",
  "race-condition",
  "type-mismatch",
  "missing-validation",
  "wrong-state-transition",
  "regex-error",
  "timezone",
  "encoding",
  "missing-migration",
  "api-contract-drift",
  "dependency-bug",
  "spec-implementation-gap",
  "other",
] as const;

export type RootCauseClass = (typeof ROOT_CAUSE_TAXONOMY)[number];

export interface PostMortemFrontmatter {
  type: "incident";
  issueNumber: number;
  prNumber: number | null;
  date: string; // YYYY-MM-DD
  status: "resolved" | "escalated" | "cannot-reproduce";
  botAttempt: number;
  featureArea: string;
  rootCauseClass: RootCauseClass;
  filesTouched: number;
  linesChanged: number;
  tokensUsed: number | null; // v1: always null
  durationMinutes: number;
  fixRetryCount: number;
  specsReferenced: string[];
  ciStatus: "passed" | "failed" | "skipped";
  reproEvidence: string | null;
  tags: string[];
}

/** Derive a kebab-case slug from a title or summary. */
export function deriveSlug(input: string, maxLen = 60): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length === 0) return "untitled";
  return slug.slice(0, maxLen).replace(/-+$/g, "");
}

/** Pick a featureArea from the diff paths and investigate's specs. */
export function deriveFeatureArea(diffPaths: string[], specsReferenced: string[]): string {
  if (specsReferenced.length > 0) {
    const s = specsReferenced[0];
    return s.replace(/-api$/, "").trim();
  }
  if (diffPaths.length > 0) {
    const first = diffPaths[0];
    const parts = first.split("/");
    if (parts.length >= 2) return parts[1].replace(/\.(go|ts|tsx|js|jsx)$/, "");
    return parts[0];
  }
  return "unknown";
}

/** Validate or coerce a root-cause class string into the fixed taxonomy. */
export function coerceRootCauseClass(raw: unknown): RootCauseClass {
  if (typeof raw === "string") {
    const k = raw.toLowerCase().trim();
    if ((ROOT_CAUSE_TAXONOMY as readonly string[]).includes(k)) return k as RootCauseClass;
  }
  return "other";
}

function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface PostMortemSources {
  issueNumber: number;
  prNumber: number | null;
  prUrl: string | null;
  issueTitle: string;
  issueBody: string;
  investigate: InvestigateOutcome;
  /** Path to handoff.md, used as input context to the claude call. */
  handoffMarkdown: string;
  /** Verify result summary. */
  verify: {
    ciStatus: "passed" | "failed" | "skipped";
    diffPaths: string[];
    softBanTouched: { path: string; category: string }[];
    fixAttemptsUsed: number;
  };
  /** When the task was created — for duration calc. */
  taskCreatedAt: string;
  /** Bot attempt (1 = first try; >1 if reopen-attempt). */
  botAttempt: number;
  /** Status outcome (drives frontmatter.status). */
  status: "resolved" | "escalated" | "cannot-reproduce";
  /** Optional: rough lines-changed estimate (0 if unknown). */
  linesChanged: number;
}

/** Estimate `rootCauseClass` heuristically from investigate's free-text. The post-mortem
 *  agent doesn't classify directly; we map the free-text root cause onto the taxonomy here. */
export function classifyRootCause(rootCauseText: string): RootCauseClass {
  const t = rootCauseText.toLowerCase();
  if (/null|nil\b|undefined|nullptr/.test(t)) return "missing-null-check";
  if (/off.by.one|off-by-one|fence.?post/.test(t)) return "off-by-one";
  if (/race|concurren[ct]|deadlock/.test(t)) return "race-condition";
  if (/type|wrong type|coercion/.test(t)) return "type-mismatch";
  if (/validat|sanitiz|input check/.test(t)) return "missing-validation";
  if (/state.machine|wrong state|invalid transition/.test(t)) return "wrong-state-transition";
  if (/regex|regular expression/.test(t)) return "regex-error";
  if (/timezone|utc|tz\b/.test(t)) return "timezone";
  if (/encoding|utf.?8|charset/.test(t)) return "encoding";
  if (/migration|schema/.test(t)) return "missing-migration";
  if (/api contract|signature|interface drift/.test(t)) return "api-contract-drift";
  if (/depend|library|upstream/.test(t)) return "dependency-bug";
  if (/spec gap|spec.implement|matches spec/.test(t)) return "spec-implementation-gap";
  return "other";
}

/** Format YAML frontmatter for the post-mortem markdown. */
export function formatFrontmatter(fm: PostMortemFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`type: ${fm.type}`);
  lines.push(`issueNumber: ${fm.issueNumber}`);
  lines.push(`prNumber: ${fm.prNumber === null ? "null" : fm.prNumber}`);
  lines.push(`date: ${fm.date}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`botAttempt: ${fm.botAttempt}`);
  lines.push(`featureArea: ${fm.featureArea}`);
  lines.push(`rootCauseClass: ${fm.rootCauseClass}`);
  lines.push(`filesTouched: ${fm.filesTouched}`);
  lines.push(`linesChanged: ${fm.linesChanged}`);
  lines.push(`tokensUsed: ${fm.tokensUsed === null ? "null" : fm.tokensUsed}`);
  lines.push(`durationMinutes: ${fm.durationMinutes}`);
  lines.push(`fixRetryCount: ${fm.fixRetryCount}`);
  lines.push(`specsReferenced: [${fm.specsReferenced.map((s) => JSON.stringify(s)).join(", ")}]`);
  lines.push(`ciStatus: ${fm.ciStatus}`);
  lines.push(`reproEvidence: ${fm.reproEvidence === null ? "null" : JSON.stringify(fm.reproEvidence)}`);
  lines.push(`tags: [${fm.tags.map((t) => JSON.stringify(t)).join(", ")}]`);
  lines.push("---");
  return lines.join("\n");
}

/** Call the post-mortem agent to produce the markdown body. */
async function generatePostMortemBody(sources: PostMortemSources): Promise<string> {
  const basePrompt = await fs.readFile(PROMPT_PATH, "utf-8");
  const contextBlock: string[] = [];
  contextBlock.push("---");
  contextBlock.push("");
  contextBlock.push("## Inputs");
  contextBlock.push("");
  contextBlock.push(`Issue: #${sources.issueNumber} — ${sources.issueTitle}`);
  if (sources.prUrl) contextBlock.push(`PR: ${sources.prUrl}`);
  contextBlock.push("");
  contextBlock.push("### Issue body");
  contextBlock.push("");
  contextBlock.push(sources.issueBody.trim() || "_(empty)_");
  contextBlock.push("");
  contextBlock.push("### Investigate result");
  contextBlock.push("");
  if (sources.investigate.ok) {
    contextBlock.push("```json");
    contextBlock.push(JSON.stringify(sources.investigate.result, null, 2));
    contextBlock.push("```");
  } else {
    contextBlock.push(`Investigate did not produce a parseable result: ${sources.investigate.error}`);
  }
  contextBlock.push("");
  contextBlock.push("### Verify summary");
  contextBlock.push("");
  contextBlock.push("```json");
  contextBlock.push(JSON.stringify(sources.verify, null, 2));
  contextBlock.push("```");
  contextBlock.push("");
  contextBlock.push("### handoff.md");
  contextBlock.push("");
  contextBlock.push(sources.handoffMarkdown.trim() || "_(no handoff)_");

  const prompt = `${basePrompt}\n\n${contextBlock.join("\n")}`;
  return await claude(prompt, {
    timeoutMs: POST_MORTEM_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    settingSources: "project",
  });
}

export interface PostMortemResult {
  fullMarkdown: string;
  frontmatter: PostMortemFrontmatter;
  slug: string;
  incidentDir: string;
  postMortemPath: string;
}

/** Build + write the post-mortem under vault/incidents/. */
export async function buildAndWritePostMortem(
  sources: PostMortemSources,
  vaultRoot: string,
): Promise<PostMortemResult> {
  const dateStr = utcDateString();
  const titleForSlug = sources.investigate.ok ? sources.issueTitle : sources.issueTitle || "untitled";
  const slug = deriveSlug(titleForSlug);
  const incidentDir = path.join(vaultRoot, "incidents", `${dateStr}_issue-${sources.issueNumber}_${slug}`);

  const rootCauseText = sources.investigate.ok ? sources.investigate.result.rootCause : "";
  const specsReferenced = sources.investigate.ok ? sources.investigate.result.specsReferenced : [];

  const frontmatter: PostMortemFrontmatter = {
    type: "incident",
    issueNumber: sources.issueNumber,
    prNumber: sources.prNumber,
    date: dateStr,
    status: sources.status,
    botAttempt: sources.botAttempt,
    featureArea: deriveFeatureArea(sources.verify.diffPaths, specsReferenced),
    rootCauseClass: classifyRootCause(rootCauseText),
    filesTouched: sources.verify.diffPaths.length,
    linesChanged: sources.linesChanged,
    tokensUsed: null,
    durationMinutes: Math.max(
      0,
      Math.round((Date.now() - new Date(sources.taskCreatedAt).getTime()) / 60_000),
    ),
    fixRetryCount: Math.max(0, sources.verify.fixAttemptsUsed - 1),
    specsReferenced,
    ciStatus: sources.verify.ciStatus,
    reproEvidence: null, // v1.1 sets this when browser repro lands
    tags: [],
  };

  const body = await generatePostMortemBody(sources);
  const fullMarkdown = `${formatFrontmatter(frontmatter)}\n\n${body.trim()}\n`;

  await fs.mkdir(incidentDir, { recursive: true });
  const postMortemPath = path.join(incidentDir, "post-mortem.md");
  await fs.writeFile(postMortemPath, fullMarkdown, "utf-8");

  // Archive the handoff alongside the post-mortem.
  if (sources.handoffMarkdown) {
    await fs.writeFile(path.join(incidentDir, "handoff.md"), sources.handoffMarkdown, "utf-8");
  }

  return { fullMarkdown, frontmatter, slug, incidentDir, postMortemPath };
}
