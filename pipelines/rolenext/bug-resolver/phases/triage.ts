import path from "path";
import fs from "fs/promises";
import type { PhaseContext, PhaseOutput, Task, GateCheckResult } from "../../../../core/lib/types.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import { createWorktree, removeWorktree, worktreePathFor } from "../lib/worktree.ts";
import { runInvestigate, type InvestigateOutcome } from "../lib/investigate-agent.ts";
import { closeIssue } from "../lib/github.ts";
import { applyForceNeedsReviewIfRequested } from "./poll-issues.ts";

interface TriageInput {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueBody: string;
  pageUrl: string;
  fingerprint: string;
  attempt: number;
  mode: "open";
  priorPrUrl: string | null;
  forceNeedsReview?: boolean;
  forceReason?: string;
}

export type TriageDecision =
  | { kind: "advance" }
  | { kind: "close-cannot-repro"; comment: string }
  | { kind: "needs_review"; reason: string };

interface TriageOutput extends Record<string, unknown> {
  /** Investigate agent result (or parse-failure marker). */
  investigate: InvestigateOutcome;
  /** Worktree path that was used (kept for downstream phases). */
  worktreePath: string | null;
  /** Whether the worktree was successfully cleaned up. */
  worktreeCleaned: boolean;
  /** Pre-computed gate decision so the deterministic check function is trivial. */
  decision: TriageDecision;
  /** Was this a reopen (attempt > 1)? */
  isReopen: boolean;
}

const CANNOT_REPRO_AUTOCOMMENT_INVESTIGATE_ONLY =
  "🤖 investigation did not surface a code-level bug — closing. Reopen with more detail if it persists.";

export async function runTriage(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  // Forced needs_review path: poll-phase already decided this task can't advance
  // (e.g. reopen attempt > 3). Honor that and short-circuit.
  if (await applyForceNeedsReviewIfRequested(task)) {
    return {
      output: {
        investigate: { ok: false, error: "force-needs-review", raw: "" },
        worktreePath: null,
        worktreeCleaned: true,
        decision: { kind: "needs_review", reason: "forced by poll phase" } as TriageDecision,
        isReopen: ((task.input as unknown as TriageInput).attempt ?? 1) > 1,
      } as TriageOutput,
    };
  }

  const input = task.input as unknown as TriageInput;
  const isReopen = (input.attempt ?? 1) > 1;

  // 1. Create the worktree (always from origin/main).
  let worktreePath: string;
  try {
    worktreePath = await createWorktree(cfg.rolenextPath, cfg.worktreeBase, input.issueNumber);
  } catch (err) {
    const reason = `worktree creation failed: ${(err as Error).message}`;
    ctx.log("worktree-failed", { issueNumber: input.issueNumber, error: reason });
    return {
      output: {
        investigate: { ok: false, error: reason, raw: "" },
        worktreePath: null,
        worktreeCleaned: true,
        decision: { kind: "needs_review", reason } as TriageDecision,
        isReopen,
      } as TriageOutput,
    };
  }

  // 2. Optional: read prior PR diff for reopen context.
  let priorPrDiff: string | undefined;
  if (isReopen && input.priorPrUrl) {
    // Best-effort: extract PR number from URL and fetch diff. If it fails, proceed without.
    const m = input.priorPrUrl.match(/\/pull\/(\d+)/);
    if (m) {
      try {
        const { prDiff } = await import("../lib/github.ts");
        priorPrDiff = await prDiff(cfg.repo, Number(m[1]));
      } catch (err) {
        ctx.log("prior-pr-diff-fetch-failed", { error: (err as Error).message });
      }
    }
  }

  // 3. Run the investigate agent (v1: investigate-only — no Playwright/repro).
  //    enableBrowserRepro is checked but v1 path is fixed to investigate-only.
  const investigate = await runInvestigate({
    worktreePath,
    issueNumber: input.issueNumber,
    issueTitle: input.issueTitle,
    issueBody: input.issueBody,
    pageUrl: input.pageUrl,
    priorPrDiff,
  });

  // 4. Persist investigate.json to the task output dir for downstream phases.
  try {
    await fs.writeFile(
      path.join(ctx.outputDir, "investigate.json"),
      JSON.stringify(investigate, null, 2),
      "utf-8",
    );
  } catch (err) {
    ctx.log("investigate-write-failed", { error: (err as Error).message });
  }

  // 5. Compute gate decision (v1 investigate-only gate).
  const decision = computeDecision(investigate, isReopen, cfg.triageThreshold);

  // 6. Side effects: cannot-repro → close issue immediately (auto-comment).
  //    The deterministic gate then routes the task to needs_review with reason
  //    "close: cannot-reproduce" so the captain can confirm the close on the
  //    dashboard. The core processor cannot produce a `completed` terminal
  //    state from a non-final phase, so needs_review is the cleanest
  //    available landing spot.
  if (decision.kind === "close-cannot-repro") {
    try {
      await closeIssue(cfg.repo, input.issueNumber, decision.comment);
    } catch (err) {
      ctx.log("issue-close-failed", { issueNumber: input.issueNumber, error: (err as Error).message });
    }
  }

  // 7. Tear down the worktree (best-effort).
  let worktreeCleaned = true;
  try {
    await removeWorktree(cfg.rolenextPath, worktreePath);
  } catch (err) {
    worktreeCleaned = false;
    ctx.log("worktree-cleanup-failed", { error: (err as Error).message });
  }

  return {
    output: {
      investigate,
      worktreePath,
      worktreeCleaned,
      decision,
      isReopen,
    } as TriageOutput,
  };
}

/** Decide outcome from investigate result. v1 investigate-only gate. */
export function computeDecision(
  outcome: InvestigateOutcome,
  isReopen: boolean,
  triageThreshold: number,
): TriageDecision {
  // Forced needs_review on reopens — captain decides whether to proceed.
  if (isReopen) {
    return { kind: "needs_review", reason: `reopen attempt — investigate ${outcome.ok ? "succeeded" : "failed"}` };
  }

  if (!outcome.ok) {
    return { kind: "needs_review", reason: "agent failed to produce structured output" };
  }

  const r = outcome.result;
  if (r.noBugFound === true) {
    return {
      kind: "close-cannot-repro",
      comment: CANNOT_REPRO_AUTOCOMMENT_INVESTIGATE_ONLY,
    };
  }
  if (r.fixKnown && r.confidence > triageThreshold) {
    return { kind: "advance" };
  }
  return { kind: "needs_review", reason: "low confidence or unclear root cause" };
}

/** Deterministic gate `check` — reads the precomputed decision in the task output. */
export async function checkTriage(task: Task): Promise<GateCheckResult> {
  const out = task.output as TriageOutput | undefined;
  if (!out || !out.decision) {
    return { pass: false, reason: "triage produced no decision" };
  }
  const d = out.decision;
  if (d.kind === "advance") return { pass: true };
  if (d.kind === "close-cannot-repro") {
    // Issue is already closed (side-effect in runTriage). Returning pass:false
    // with reason "close: cannot-reproduce" lands the task in needs_review so
    // the captain confirms the recommended close on the dashboard.
    return { pass: false, reason: "close: cannot-reproduce (no code-level bug)" };
  }
  return { pass: false, reason: d.reason };
}
