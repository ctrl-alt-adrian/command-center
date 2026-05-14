import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { claudeInCwd } from "./claude-in-cwd.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPT_PATH = path.resolve(__dirname, "..", "prompts", "investigate.md");
const INVESTIGATE_TIMEOUT_MS = 12 * 60_000;
const INVESTIGATE_MAX_BUFFER = 50 * 1024 * 1024;

export interface InvestigateInput {
  worktreePath: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  pageUrl: string;
  /** Present on reopens — the unified diff of the prior merged PR. */
  priorPrDiff?: string;
}

export interface FileImplicated {
  path: string;
  lineRange?: [number, number];
}

export interface InvestigateResult {
  fixKnown: boolean;
  confidence: number;
  rootCause: string;
  filesImplicated: FileImplicated[];
  specsReferenced: string[];
  proposedFix: string;
  notes: string;
  noBugFound?: boolean;
}

export type InvestigateOutcome =
  | { ok: true; result: InvestigateResult; raw: string }
  | { ok: false; error: string; raw: string };

const STRICT_JSON_SUFFIX =
  "\n\nYour previous response did not contain a valid JSON object. " +
  "Respond ONLY with the JSON object — no surrounding text, no fenced code block.";

function extractJson(raw: string): string | null {
  // Try fenced ```json block first.
  const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) return fence[1];
  // Fall back to the last balanced JSON object in the text.
  const last = raw.lastIndexOf("}");
  if (last < 0) return null;
  // Walk backward to find the matching opening brace.
  let depth = 0;
  for (let i = last; i >= 0; i--) {
    if (raw[i] === "}") depth++;
    else if (raw[i] === "{") {
      depth--;
      if (depth === 0) return raw.slice(i, last + 1);
    }
  }
  return null;
}

function validate(parsed: unknown): InvestigateResult | string {
  if (!parsed || typeof parsed !== "object") return "not an object";
  const p = parsed as Record<string, unknown>;
  if (typeof p.fixKnown !== "boolean") return "fixKnown must be boolean";
  if (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1)
    return "confidence must be a number between 0 and 1";
  if (typeof p.rootCause !== "string") return "rootCause must be string";
  if (!Array.isArray(p.filesImplicated)) return "filesImplicated must be array";
  if (!Array.isArray(p.specsReferenced)) return "specsReferenced must be array";
  if (typeof p.proposedFix !== "string") return "proposedFix must be string";
  if (typeof p.notes !== "string") return "notes must be string";

  const filesImplicated: FileImplicated[] = [];
  for (const f of p.filesImplicated as unknown[]) {
    if (!f || typeof f !== "object") return "filesImplicated entries must be objects";
    const ff = f as Record<string, unknown>;
    if (typeof ff.path !== "string") return "filesImplicated.path must be string";
    const entry: FileImplicated = { path: ff.path };
    if (Array.isArray(ff.lineRange) && ff.lineRange.length === 2) {
      const [a, b] = ff.lineRange as unknown[];
      if (typeof a === "number" && typeof b === "number") entry.lineRange = [a, b];
    }
    filesImplicated.push(entry);
  }
  const specsReferenced: string[] = [];
  for (const s of p.specsReferenced as unknown[]) {
    if (typeof s !== "string") return "specsReferenced entries must be strings";
    specsReferenced.push(s);
  }
  return {
    fixKnown: p.fixKnown,
    confidence: p.confidence,
    rootCause: p.rootCause,
    filesImplicated,
    specsReferenced,
    proposedFix: p.proposedFix,
    notes: p.notes,
    noBugFound: p.noBugFound === true ? true : false,
  };
}

function buildPrompt(input: InvestigateInput, basePrompt: string): string {
  const parts = [basePrompt, "", "---", "", "## Bug report"];
  parts.push(`- Issue #${input.issueNumber}: ${input.issueTitle}`);
  if (input.pageUrl) parts.push(`- Page URL: ${input.pageUrl}`);
  parts.push("", "### Body", "", input.issueBody || "(no body)", "");
  if (input.priorPrDiff && input.priorPrDiff.trim().length > 0) {
    parts.push(
      "---",
      "",
      "## Prior PR diff (this issue was reopened — the bot already tried to fix it)",
      "",
      "```diff",
      input.priorPrDiff,
      "```",
      "",
      "Explicitly contrast what the prior attempt changed against the symptoms now being reported.",
    );
  }
  parts.push(
    "---",
    "",
    `## Worktree`,
    "",
    `You are running inside the worktree at \`${input.worktreePath}\`. All file paths in your output should be relative to this worktree root.`,
  );
  return parts.join("\n");
}

async function callOnce(prompt: string, cwd: string): Promise<{ raw: string }> {
  const raw = await claudeInCwd(prompt, {
    cwd,
    timeoutMs: INVESTIGATE_TIMEOUT_MS,
    maxBuffer: INVESTIGATE_MAX_BUFFER,
    settingSources: "project",
  });
  return { raw };
}

/** Run the investigate agent with one retry on JSON-parse failure. */
export async function runInvestigate(input: InvestigateInput): Promise<InvestigateOutcome> {
  const basePrompt = await fs.readFile(PROMPT_PATH, "utf-8");
  const prompt = buildPrompt(input, basePrompt);

  let { raw } = await callOnce(prompt, input.worktreePath);
  let extracted = extractJson(raw);
  let parseError = "no JSON object found";
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted);
      const valid = validate(parsed);
      if (typeof valid !== "string") return { ok: true, result: valid, raw };
      parseError = `validation: ${valid}`;
    } catch (err) {
      parseError = `parse: ${(err as Error).message}`;
    }
  }

  // Retry once with strict JSON instruction.
  const retryPrompt = prompt + STRICT_JSON_SUFFIX;
  const second = await callOnce(retryPrompt, input.worktreePath);
  raw = second.raw;
  extracted = extractJson(raw);
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted);
      const valid = validate(parsed);
      if (typeof valid !== "string") return { ok: true, result: valid, raw };
      parseError = `retry validation: ${valid}`;
    } catch (err) {
      parseError = `retry parse: ${(err as Error).message}`;
    }
  } else {
    parseError = "retry: no JSON object found";
  }

  return { ok: false, error: parseError, raw };
}
