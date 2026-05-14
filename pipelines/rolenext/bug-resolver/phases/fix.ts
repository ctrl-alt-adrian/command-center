import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import { createWorktree, worktreePathFor, branchNameFor } from "../lib/worktree.ts";
import { runFix, runFixRevision } from "../lib/fix-agent.ts";
import { getPRComments, getPR, type GitHubReviewComment } from "../lib/github.ts";

const execFileAsync = promisify(execFile);

interface FixPhaseInput {
  issueNumber: number;
  attempt?: number;
  mode?: "open" | "revision";
  prNumber?: number;
  reviewerNote?: string;
}

interface FixPhaseOutput extends Record<string, unknown> {
  mode: "open" | "revision";
  worktreePath: string;
  diffPaths: string[];
  diffSize: number;
  blocked: boolean;
  blockedReason: string | null;
  committed: boolean;
}

const PIPELINE_ID = "rolenext-bug-resolver";

/** Re-create the worktree at the existing branch's tip (for revision mode).
 *  We fetch the latest origin/<branch>, then `git worktree add <path> <branch>` so
 *  the worktree is a fresh checkout of the PR's HEAD. */
async function createRevisionWorktree(
  cfg: RolenextBugResolverConfig,
  issueNumber: number,
): Promise<string> {
  const wtPath = worktreePathFor(cfg.worktreeBase, issueNumber);
  const branch = branchNameFor(issueNumber);
  // Best-effort cleanup of any stale worktree at the target.
  await execFileAsync("git", ["worktree", "remove", "--force", wtPath], {
    cwd: cfg.rolenextPath,
    encoding: "utf-8",
  }).catch(() => undefined);
  await fs.mkdir(cfg.worktreeBase, { recursive: true });
  // Fetch the latest PR branch from origin.
  await execFileAsync("git", ["fetch", "origin", `${branch}:${branch}`, "--force"], {
    cwd: cfg.rolenextPath,
    encoding: "utf-8",
  });
  await execFileAsync("git", ["worktree", "add", wtPath, branch], {
    cwd: cfg.rolenextPath,
    encoding: "utf-8",
  });
  return wtPath;
}

/** Load the prior handoff for a revision task by walking up to the most-recent
 *  completed write-handoff task for the same issue. */
async function loadPriorHandoff(issueNumber: number, ctx: PhaseContext): Promise<string> {
  const tasks = await listTasksByPipeline(PIPELINE_ID);
  const matches = tasks
    .filter((t) => (t.input as { issueNumber?: number }).issueNumber === issueNumber)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const t of matches) {
    const handoffPath = path.join(
      path.resolve(ctx.outputDir, "..", "..", t.id, "write-handoff", "handoff.md"),
    );
    try {
      return await fs.readFile(handoffPath, "utf-8");
    } catch {
      // try next
    }
  }
  return "";
}

function asReviewComment(c: GitHubReviewComment): {
  user: string;
  body: string;
  path: string;
  line: number | null;
  diffHunk: string;
  createdAt: string;
} {
  return {
    user: c.user.login,
    body: c.body,
    path: c.path,
    line: c.line,
    diffHunk: c.diff_hunk,
    createdAt: c.created_at,
  };
}

export async function runFixPhase(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  const input = task.input as unknown as FixPhaseInput;
  const mode = input.mode ?? "open";

  if (mode === "revision") {
    if (!input.prNumber) {
      throw new Error("fix-phase: revision mode requires input.prNumber");
    }

    // 1. Verify the PR still exists (defensive — captain might have closed it).
    const pr = await getPR(cfg.repo, input.prNumber);
    if (!pr) throw new Error(`fix-phase: PR #${input.prNumber} not found on ${cfg.repo}`);

    // 2. Re-create worktree at the existing PR branch's tip.
    const worktreePath = await createRevisionWorktree(cfg, input.issueNumber);

    // 3. Pull line-level PR review comments via gh api.
    const rawComments = await getPRComments(cfg.repo, input.prNumber).catch(() => []);
    const reviewComments = rawComments.map(asReviewComment);

    // 4. Load the prior handoff for context.
    const priorHandoffBody = await loadPriorHandoff(input.issueNumber, ctx);

    // 5. Run the revision agent.
    const fix = await runFixRevision({
      worktreePath,
      priorHandoffBody,
      issueNumber: input.issueNumber,
      prNumber: input.prNumber,
      reviewerNote: input.reviewerNote,
      reviewComments,
    });

    await fs.writeFile(path.join(ctx.outputDir, "fix-agent-output.txt"), fix.raw, "utf-8");
    await fs.writeFile(path.join(ctx.outputDir, "fix-diff.patch"), fix.diff, "utf-8");
    await fs.writeFile(
      path.join(ctx.outputDir, "review-comments.json"),
      JSON.stringify(reviewComments, null, 2),
      "utf-8",
    );

    ctx.log("fix-revision-done", {
      blocked: fix.blocked,
      committed: fix.committed,
      files: fix.diffPaths.length,
      reviewComments: reviewComments.length,
    });

    const out: FixPhaseOutput = {
      mode: "revision",
      worktreePath,
      diffPaths: fix.diffPaths,
      diffSize: fix.diff.length,
      blocked: fix.blocked,
      blockedReason: fix.blockedReason,
      committed: fix.committed,
    };
    return { output: out };
  }

  // --- open mode (default) ---
  const handoffPath = path.join(ctx.inputDir, "handoff.md");
  const handoffBody = await fs.readFile(handoffPath, "utf-8");
  const worktreePath = await createWorktree(cfg.rolenextPath, cfg.worktreeBase, input.issueNumber);

  const fix = await runFix({
    worktreePath,
    handoffBody,
    issueNumber: input.issueNumber,
  });

  await fs.writeFile(path.join(ctx.outputDir, "fix-agent-output.txt"), fix.raw, "utf-8");
  await fs.writeFile(path.join(ctx.outputDir, "fix-diff.patch"), fix.diff, "utf-8");

  ctx.log("fix-done", {
    blocked: fix.blocked,
    committed: fix.committed,
    files: fix.diffPaths.length,
    diffBytes: fix.diff.length,
  });

  const out: FixPhaseOutput = {
    mode: "open",
    worktreePath,
    diffPaths: fix.diffPaths,
    diffSize: fix.diff.length,
    blocked: fix.blocked,
    blockedReason: fix.blockedReason,
    committed: fix.committed,
  };
  return { output: out };
}

export function fixWorktreePath(cfg: RolenextBugResolverConfig, issueNumber: number): string {
  return worktreePathFor(cfg.worktreeBase, issueNumber);
}
