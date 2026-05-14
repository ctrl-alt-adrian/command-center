import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

const GIT_MAX_BUFFER = 10 * 1024 * 1024;
const GIT_DEFAULT_TIMEOUT_MS = 60_000;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: GIT_MAX_BUFFER,
    timeout: GIT_DEFAULT_TIMEOUT_MS,
    encoding: "utf-8",
  });
  return (stdout as string).trim();
}

async function gitMaybe(cwd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: GIT_DEFAULT_TIMEOUT_MS,
      encoding: "utf-8",
    });
    return { ok: true, stdout: (stdout as string).trim(), stderr: (stderr as string).trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, stdout: (e.stdout ?? "").toString().trim(), stderr: (e.stderr ?? "").toString().trim() };
  }
}

function branchName(issueNumber: number): string {
  return `bug/issue-${issueNumber}`;
}

/**
 * Create a fresh worktree for an issue, branched from origin/main.
 * Always runs `git fetch origin main` first so the worktree is built on the remote tip,
 * NOT the local main checkout. Returns the absolute worktree path.
 *
 * If a worktree already exists at the target path, removes it (force) before recreating —
 * keeps the operation idempotent across retries.
 */
export async function createWorktree(
  rolenextPath: string,
  worktreeBase: string,
  issueNumber: number,
): Promise<string> {
  await fs.mkdir(worktreeBase, { recursive: true });
  const wtPath = path.join(worktreeBase, `rolenext-issue-${issueNumber}`);
  const branch = branchName(issueNumber);

  // 1. Ensure origin/main is up to date.
  await git(rolenextPath, ["fetch", "origin", "main"]);

  // 2. Clean up any stale worktree at the target path.
  await removeWorktree(rolenextPath, wtPath).catch(() => undefined);

  // 3. Clean up a stale branch of the same name (could exist from a prior failed run).
  await gitMaybe(rolenextPath, ["branch", "-D", branch]);

  // 4. Add a fresh worktree from origin/main with the new branch.
  await git(rolenextPath, ["worktree", "add", wtPath, "origin/main", "-b", branch]);

  return wtPath;
}

/**
 * Remove a worktree. Falls back to force-remove on stale lock files,
 * then `git worktree prune` to clean up the metadata.
 *
 * Best-effort: does not throw on already-missing worktrees (idempotent).
 */
export async function removeWorktree(rolenextPath: string, wtPath: string): Promise<void> {
  const exists = await fs
    .stat(wtPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    await gitMaybe(rolenextPath, ["worktree", "prune"]);
    return;
  }

  // Try clean remove first.
  let r = await gitMaybe(rolenextPath, ["worktree", "remove", wtPath]);
  if (!r.ok) {
    // Force-remove handles stale lock files / dirty trees.
    r = await gitMaybe(rolenextPath, ["worktree", "remove", "--force", wtPath]);
  }
  if (!r.ok) {
    // Last resort: rm the dir directly and prune metadata.
    await fs.rm(wtPath, { recursive: true, force: true });
    await gitMaybe(rolenextPath, ["worktree", "prune"]);
  }
}

/**
 * Return `git diff --name-only origin/main...HEAD` from inside the worktree.
 * Always uses origin/main as the baseline, NEVER local main.
 */
export async function diffAgainstMain(worktreePath: string): Promise<string[]> {
  // Make sure origin/main is current inside the worktree's view.
  await git(worktreePath, ["fetch", "origin", "main"]);
  const out = await git(worktreePath, ["diff", "--name-only", "origin/main...HEAD"]);
  if (!out) return [];
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Return the full unified diff against origin/main — for PR bodies, patches, etc. */
export async function fullDiffAgainstMain(worktreePath: string): Promise<string> {
  await git(worktreePath, ["fetch", "origin", "main"]);
  return await git(worktreePath, ["diff", "origin/main...HEAD"]);
}

/** Return the worktree path for an issue number (used for cleanup paths). */
export function worktreePathFor(worktreeBase: string, issueNumber: number): string {
  return path.join(worktreeBase, `rolenext-issue-${issueNumber}`);
}

/** Return the branch name for an issue number. */
export function branchNameFor(issueNumber: number): string {
  return branchName(issueNumber);
}
