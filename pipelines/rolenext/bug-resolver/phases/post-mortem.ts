import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { getTask } from "../../../../core/lib/tasks.ts";
import { removeWorktree } from "../lib/worktree.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import { handoffDirFromTask, readHandoff } from "../lib/handoff.ts";
import { buildAndWritePostMortem } from "../lib/post-mortem.ts";
import type { InvestigateOutcome } from "../lib/investigate-agent.ts";
import { upsertFingerprint } from "../lib/state.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// vault/ lives at command-center root, three levels above this file's pipeline dir.
// pipelines/software-factory/rolenext-bug-resolver/phases/post-mortem.ts → command-center/
const COMMAND_CENTER_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const VAULT_ROOT = path.join(COMMAND_CENTER_ROOT, "vault");

interface PostMortemInput {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  attempt?: number;
  fingerprint?: string;
  // Carried from pr phase:
  prUrl?: string | null;
  // Carried from triage phase:
  investigate?: InvestigateOutcome;
  // Carried from verify phase:
  diffPaths?: string[];
  softBanTouched?: { path: string; category: string }[];
  fixAttemptsUsed?: number;
  makeCi?: { ok: boolean };
}

function extractPrNumber(url: string | null | undefined): number | null {
  if (!url) return null;
  const m = url.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function runPostMortemPhase(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  const input = task.input as unknown as PostMortemInput;

  // write-handoff ran on a prior task — pull its dir from input.handoffPath
  // rather than the wrong relative path.
  const handoffDir = handoffDirFromTask(task);
  const handoffBody = (await readHandoff(handoffDir)) ?? "";

  // Pull the parent task to get a stable createdAt (post-mortem task's createdAt
  // would be near-now). For v1, fall back to this task's createdAt if no parent.
  const parentId = task.parentId ?? task.id;
  const parent = parentId === task.id ? null : await getTask(parentId);
  const taskCreatedAt = parent?.createdAt ?? task.createdAt;

  const investigate = input.investigate ?? { ok: false, error: "no investigate result on input", raw: "" };

  const ciStatus: "passed" | "failed" | "skipped" =
    input.makeCi?.ok === true ? "passed" : input.makeCi?.ok === false ? "failed" : "skipped";

  const prNumber = extractPrNumber(input.prUrl);
  const status: "resolved" | "escalated" | "cannot-reproduce" =
    prNumber !== null && ciStatus === "passed" ? "resolved" : "escalated";

  const result = await buildAndWritePostMortem(
    {
      issueNumber: input.issueNumber,
      prNumber,
      prUrl: input.prUrl ?? null,
      issueTitle: input.issueTitle,
      issueBody: input.issueBody,
      investigate,
      handoffMarkdown: handoffBody,
      verify: {
        ciStatus,
        diffPaths: input.diffPaths ?? [],
        softBanTouched: input.softBanTouched ?? [],
        fixAttemptsUsed: input.fixAttemptsUsed ?? 1,
      },
      taskCreatedAt,
      botAttempt: input.attempt ?? 1,
      status,
      linesChanged: 0, // v1: we don't compute this; could parse the diff later
    },
    VAULT_ROOT,
  );

  // Tear down the worktree (best-effort) — task is terminal.
  try {
    await removeWorktree(cfg.rolenextPath, path.join(cfg.worktreeBase, `rolenext-issue-${input.issueNumber}`));
  } catch (err) {
    ctx.log("worktree-cleanup-failed", { error: (err as Error).message });
  }

  // Update fingerprint store to reflect terminal status.
  if (input.fingerprint) {
    await upsertFingerprint(input.fingerprint, {
      issueNumber: input.issueNumber,
      status: prNumber !== null ? "pr-open" : "closed",
      prUrl: input.prUrl ?? null,
      seenAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  // Symlink-friendly artifact path written into the task output for the dashboard.
  await fs.writeFile(
    path.join(ctx.outputDir, "post-mortem-path.txt"),
    result.postMortemPath,
    "utf-8",
  );

  ctx.log("post-mortem-written", {
    path: result.postMortemPath,
    slug: result.slug,
    rootCauseClass: result.frontmatter.rootCauseClass,
    status: result.frontmatter.status,
  });

  return {
    output: {
      postMortemPath: result.postMortemPath,
      incidentDir: result.incidentDir,
      slug: result.slug,
      rootCauseClass: result.frontmatter.rootCauseClass,
      featureArea: result.frontmatter.featureArea,
      status: result.frontmatter.status,
    },
  };
}
