import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { claudeInCwd } from "./claude-in-cwd.ts";
import { fullDiffAgainstMain } from "./worktree.ts";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIX_PROMPT_PATH = path.resolve(__dirname, "..", "prompts", "fix.md");
const FIX_REVISION_PROMPT_PATH = path.resolve(__dirname, "..", "prompts", "fix-revision.md");
const FIX_TIMEOUT_MS = 45 * 60_000;
const FIX_MAX_BUFFER = 50 * 1024 * 1024;

export interface FixInput {
  worktreePath: string;
  handoffBody: string;
  issueNumber: number;
}

export interface RevisionInput {
  worktreePath: string;
  priorHandoffBody: string;
  issueNumber: number;
  prNumber: number;
  /** Optional high-level note from the captain (manual button only). */
  reviewerNote?: string;
  /** Line-level review comments pulled from gh api. */
  reviewComments: Array<{
    user: string;
    body: string;
    path: string;
    line: number | null;
    diffHunk: string;
    createdAt: string;
  }>;
}

export interface FixResult {
  raw: string;
  blocked: boolean;
  blockedReason: string | null;
  diff: string;
  diffPaths: string[];
  committed: boolean;
}

function buildPrompt(input: FixInput, basePrompt: string): string {
  return [
    basePrompt,
    "",
    "---",
    "",
    "## handoff.md",
    "",
    input.handoffBody.trim(),
    "",
    "---",
    "",
    `## Worktree`,
    "",
    `You are running inside \`${input.worktreePath}\`. Edit files in place and commit when done.`,
    `Issue number for the commit message: #${input.issueNumber}.`,
  ].join("\n");
}

function detectBlocked(raw: string): string | null {
  const lines = raw.split("\n").reverse();
  for (const line of lines) {
    const m = line.match(/^BLOCKED:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

async function gitDiffNames(cwd: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["diff", "--name-only", "origin/main...HEAD"], {
    cwd,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return (stdout as string)
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function gitHasCommitsAheadMain(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-list", "--count", "origin/main..HEAD"], {
      cwd,
      encoding: "utf-8",
    });
    return parseInt((stdout as string).trim(), 10) > 0;
  } catch {
    return false;
  }
}

function buildRevisionPrompt(input: RevisionInput, basePrompt: string): string {
  const parts: string[] = [
    basePrompt,
    "",
    "---",
    "",
    "## Prior handoff.md (context — DO NOT re-do this fix)",
    "",
    input.priorHandoffBody.trim(),
    "",
    "---",
    "",
    "## PR under revision",
    "",
    `PR #${input.prNumber} on issue #${input.issueNumber}.`,
  ];
  if (input.reviewerNote && input.reviewerNote.trim().length > 0) {
    parts.push("");
    parts.push("## Captain's high-level note");
    parts.push("");
    parts.push(input.reviewerNote.trim());
  }
  parts.push("", "## Line-level review comments");
  parts.push("");
  if (input.reviewComments.length === 0) {
    parts.push("_No line-level comments — work only from the high-level note above._");
  } else {
    for (let i = 0; i < input.reviewComments.length; i++) {
      const c = input.reviewComments[i];
      parts.push(`### Comment ${i + 1} — @${c.user} on \`${c.path}${c.line !== null ? ":" + c.line : ""}\``);
      parts.push("");
      parts.push("Diff hunk:");
      parts.push("```diff");
      parts.push(c.diffHunk.trim());
      parts.push("```");
      parts.push("");
      parts.push("Comment:");
      parts.push("");
      parts.push(c.body.trim());
      parts.push("");
    }
  }
  parts.push("", "---", "");
  parts.push(`## Worktree`);
  parts.push("");
  parts.push(`You are inside \`${input.worktreePath}\` on branch \`bug/issue-${input.issueNumber}\`. Address the comments above, then commit.`);
  return parts.join("\n");
}

/** Run the fix agent in REVISION mode against an existing branch with reviewer feedback. */
export async function runFixRevision(input: RevisionInput): Promise<FixResult> {
  const basePrompt = await fs.readFile(FIX_REVISION_PROMPT_PATH, "utf-8");
  const prompt = buildRevisionPrompt(input, basePrompt);

  const raw = await claudeInCwd(prompt, {
    cwd: input.worktreePath,
    timeoutMs: FIX_TIMEOUT_MS,
    maxBuffer: FIX_MAX_BUFFER,
    settingSources: "project",
  });

  const blockedReason = detectBlocked(raw);
  const committed = await gitHasCommitsAheadMain(input.worktreePath);

  let diff = "";
  let diffPaths: string[] = [];
  try {
    diff = await fullDiffAgainstMain(input.worktreePath);
    diffPaths = await gitDiffNames(input.worktreePath);
  } catch {
    // empty diff capture
  }

  return { raw, blocked: blockedReason !== null, blockedReason, diff, diffPaths, committed };
}

/** Run the fix agent. Returns the captured diff, paths touched, blocked status. */
export async function runFix(input: FixInput): Promise<FixResult> {
  const basePrompt = await fs.readFile(FIX_PROMPT_PATH, "utf-8");
  const prompt = buildPrompt(input, basePrompt);

  const raw = await claudeInCwd(prompt, {
    cwd: input.worktreePath,
    timeoutMs: FIX_TIMEOUT_MS,
    maxBuffer: FIX_MAX_BUFFER,
    settingSources: "project",
  });

  const blockedReason = detectBlocked(raw);
  const committed = await gitHasCommitsAheadMain(input.worktreePath);

  let diff = "";
  let diffPaths: string[] = [];
  try {
    diff = await fullDiffAgainstMain(input.worktreePath);
    diffPaths = await gitDiffNames(input.worktreePath);
  } catch {
    // Fall through with empty diff — verify will report it.
  }

  return {
    raw,
    blocked: blockedReason !== null,
    blockedReason,
    diff,
    diffPaths,
    committed,
  };
}
