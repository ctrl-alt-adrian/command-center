import fs from "fs/promises";
import path from "path";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import { branchNameFor, worktreePathFor } from "../lib/worktree.ts";
import { createPR, prDraft, commentOnPR } from "../lib/github.ts";
import { buildPrBody, buildPrTitle, deriveArea, pushBranch } from "../lib/pr.ts";
import { upsertFingerprint } from "../lib/state.ts";
import { loadHandoffForTask } from "../lib/handoff.ts";
import type { SoftBanHit } from "../lib/verify/write-policy.ts";

interface PrInput {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  fingerprint: string;
  mode?: "open" | "revision";
  prNumber?: number;
  // From verify phase (merged into input via processor advanceOrComplete):
  softBanTouched?: SoftBanHit[];
  diffPaths?: string[];
  fixAttemptsUsed?: number;
  regressionTest?: { ok: boolean; testFiles: string[] };
  makeCi?: { ok: boolean };
  // From triage phase (merged):
  investigate?: {
    ok: boolean;
    result?: { rootCause: string; proposedFix: string };
  };
}

interface PrOutput extends Record<string, unknown> {
  mode: "open" | "revision";
  prUrl: string | null;
  branch: string;
  bodyPath: string;
}

const PR_LABELS_BASE = ["bot-fix", "bug", "auto-triaged"];
const SOFT_BAN_LABEL = "bot-touched-soft-banned";
const CAPTAIN_USER = "ctrl-alt-adrian";
const REVISION_COMMENT = "🤖 pushed revision addressing review";

async function runRevisionMode(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig,
): Promise<PhaseOutput> {
  const input = task.input as unknown as PrInput;
  if (!input.prNumber) {
    throw new Error("pr-phase revision: input.prNumber required");
  }
  const branch = branchNameFor(input.issueNumber);
  const worktreePath = worktreePathFor(cfg.worktreeBase, input.issueNumber);

  // Push the new commit to the existing branch.
  try {
    await pushBranch(worktreePath, branch);
  } catch (err) {
    throw new Error(`git push (revision) failed: ${(err as Error).message}`);
  }

  // Flip PR back to draft (captain will re-toggle to ready when satisfied).
  try {
    await prDraft(cfg.repo, input.prNumber, true);
  } catch (err) {
    ctx.log("pr-draft-toggle-failed", { error: (err as Error).message });
  }

  // Post the revision-pushed comment.
  try {
    await commentOnPR(cfg.repo, input.prNumber, REVISION_COMMENT);
  } catch (err) {
    ctx.log("pr-comment-failed", { error: (err as Error).message });
  }

  // Construct the canonical PR URL so downstream phases (post-mortem) have it.
  const prUrl = `https://github.com/${cfg.repo}/pull/${input.prNumber}`;

  ctx.log("pr-revision-pushed", { url: prUrl, branch, prNumber: input.prNumber });

  const out: PrOutput = { mode: "revision", prUrl, branch, bodyPath: "" };
  return { output: out };
}

export async function runPrPhase(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  const input = task.input as unknown as PrInput;
  const mode = input.mode ?? "open";

  if (mode === "revision") {
    return await runRevisionMode(task, ctx, cfg);
  }

  const branch = branchNameFor(input.issueNumber);
  const worktreePath = worktreePathFor(cfg.worktreeBase, input.issueNumber);

  // Read handoff for the PR body. Prefer the embedded input.handoffBody so we
  // don't depend on the write-handoff task's dir still being on disk.
  let handoffBody = "_handoff not found_";
  try {
    const loaded = await loadHandoffForTask(task);
    handoffBody = loaded.body;
    if (loaded.source === "file") {
      ctx.log("handoff-source-fallback", { phase: "pr", note: "read from filesystem" });
    }
  } catch (err) {
    ctx.log("handoff-load-failed", { phase: "pr", error: (err as Error).message });
  }

  // Pull root cause + proposed fix from investigate (carried in input via processor merge).
  const rootCause = input.investigate?.result?.rootCause ?? "";
  const fixSummary = input.investigate?.result?.proposedFix ?? "";

  const filesChanged = input.diffPaths ?? [];
  const testFilesAdded = input.regressionTest?.testFiles ?? [];
  const softBanTouched = input.softBanTouched ?? [];
  const ciStatus: "passed" | "failed" | "skipped" =
    input.makeCi?.ok === true ? "passed" : input.makeCi?.ok === false ? "failed" : "skipped";

  const area = deriveArea(filesChanged);
  const title = buildPrTitle(area, input.issueTitle, input.issueNumber);
  const body = buildPrBody({
    issueNumber: input.issueNumber,
    issueTitle: input.issueTitle,
    bugSummary: input.issueBody,
    rootCause,
    fixSummary,
    filesChanged,
    testFilesAdded,
    ciStatus,
    fixAttempts: input.fixAttemptsUsed ?? 1,
    softBanTouched,
    handoffMarkdown: handoffBody,
  });

  const bodyPath = path.join(ctx.outputDir, "pr-body.md");
  await fs.writeFile(bodyPath, body, "utf-8");

  // Push the branch.
  try {
    await pushBranch(worktreePath, branch);
  } catch (err) {
    throw new Error(`git push failed: ${(err as Error).message}`);
  }

  // Compose labels — base + soft-ban callout when applicable.
  const labels = [...PR_LABELS_BASE];
  if (softBanTouched.length > 0) labels.push(SOFT_BAN_LABEL);

  // Create the draft PR.
  let prUrl: string | null = null;
  try {
    prUrl = await createPR(cfg.repo, {
      title,
      body,
      head: branch,
      base: "main",
      draft: true,
      labels,
      assignees: [CAPTAIN_USER],
      reviewers: [CAPTAIN_USER],
    });
  } catch (err) {
    throw new Error(`gh pr create failed: ${(err as Error).message}`);
  }

  // Update fingerprint state — PR is now open.
  if (input.fingerprint) {
    await upsertFingerprint(input.fingerprint, {
      issueNumber: input.issueNumber,
      status: "pr-open",
      prUrl,
      seenAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  ctx.log("pr-created", { url: prUrl, branch, labels, softBanCount: softBanTouched.length });

  const out: PrOutput = { mode, prUrl, branch, bodyPath };
  return { output: out };
}
