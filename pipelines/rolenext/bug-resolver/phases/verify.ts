import fs from "fs/promises";
import path from "path";
import type { GateCheckResult, PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import { diffAgainstMain, worktreePathFor } from "../lib/worktree.ts";
import { scanWritePolicy, type SoftBanHit } from "../lib/verify/write-policy.ts";
import { checkRegressionTests } from "../lib/verify/regression-test.ts";
import { runMakeCi, type MakeCiResult } from "../lib/verify/make-ci.ts";
import { appendAttemptFailure, readHandoff, writeHandoff } from "../lib/handoff.ts";
import { runFix } from "../lib/fix-agent.ts";

interface VerifyInput {
  issueNumber: number;
  blocked?: boolean;
  blockedReason?: string | null;
  committed?: boolean;
}

interface AttemptRecord {
  attempt: number;                  // 1-indexed (attempt 1 = initial fix from fix phase)
  diffPaths: string[];
  writePolicyOk: boolean;
  regressionOk: boolean;
  makeCiOk: boolean | null;         // null when not run (skipped due to prior failure)
  makeCiExitCode: number | null;
  makeCiDurationMs: number;
  failures: string[];
}

interface VerifyOutput extends Record<string, unknown> {
  ok: boolean;
  /** The final attempt's results — what the PR phase consumes. */
  writePolicy: { ok: boolean; hard: string[]; soft: SoftBanHit[] };
  regressionTest: { ok: boolean; testFiles: string[] };
  makeCi: { ok: boolean; exitCode: number | null; durationMs: number };
  softBanTouched: SoftBanHit[];
  diffPaths: string[];
  failures: string[];
  /** Per-attempt history for the PR body + dashboard. */
  attempts: AttemptRecord[];
  fixAttemptsUsed: number;
  worktreePath: string;
}

interface ChecksContext {
  worktreePath: string;
  cfg: RolenextBugResolverConfig;
  ctx: PhaseContext;
  attemptNumber: number;
}

interface ChecksResult {
  attempt: AttemptRecord;
  writePolicy: ReturnType<typeof scanWritePolicy>;
  regression: ReturnType<typeof checkRegressionTests>;
  makeCi: MakeCiResult | null;
  /** Whether `make ci` was the SOLE remaining failure (i.e. write-policy + regression are ok). */
  ciOnlyFailure: boolean;
}

async function runAllChecks(c: ChecksContext): Promise<ChecksResult> {
  const failures: string[] = [];

  // 1. Diff.
  let diffPaths: string[] = [];
  try {
    diffPaths = await diffAgainstMain(c.worktreePath);
  } catch (err) {
    failures.push(`diff-failed: ${(err as Error).message}`);
  }

  // 2. Write policy.
  const writePolicy = scanWritePolicy(diffPaths, c.cfg.writePolicy.hardBan, c.cfg.writePolicy.softBan);
  for (const p of writePolicy.hard) failures.push(`fix touched ${p} (hard-banned)`);

  // 3. Regression test.
  let regression = { ok: true, testFiles: [] as string[] };
  if (c.cfg.requireRegressionTest) {
    regression = checkRegressionTests(diffPaths);
    if (!regression.ok) failures.push("no regression test added");
  }

  // 4. make ci — skip if a non-CI failure already exists (CI re-runs won't change those).
  const skipCi = failures.length > 0;
  let makeCi: MakeCiResult | null = null;
  if (!skipCi) {
    makeCi = await runMakeCi(c.worktreePath);
    if (!makeCi.ok) failures.push(`make ci failed (exit ${makeCi.exitCode ?? "?"})`);
  }

  const attempt: AttemptRecord = {
    attempt: c.attemptNumber,
    diffPaths,
    writePolicyOk: writePolicy.ok,
    regressionOk: regression.ok,
    makeCiOk: makeCi ? makeCi.ok : null,
    makeCiExitCode: makeCi ? makeCi.exitCode : null,
    makeCiDurationMs: makeCi ? makeCi.durationMs : 0,
    failures: [...failures],
  };

  // CI-only failure means: write-policy is clean, regression is present, but ci failed.
  // This is the ONLY case where re-running the fix agent could change the outcome.
  const ciOnlyFailure = writePolicy.ok && regression.ok && makeCi !== null && !makeCi.ok;

  // Persist per-attempt CI log.
  if (makeCi && (makeCi.stdoutTail || makeCi.stderrTail)) {
    await fs.writeFile(
      path.join(c.ctx.outputDir, `make-ci-attempt-${c.attemptNumber}.log`),
      `=== STDOUT (tail) ===\n${makeCi.stdoutTail}\n\n=== STDERR (tail) ===\n${makeCi.stderrTail}\n`,
      "utf-8",
    );
  }

  c.ctx.log("verify-attempt", {
    attempt: c.attemptNumber,
    hard: writePolicy.hard.length,
    soft: writePolicy.soft.length,
    regressionOk: regression.ok,
    ciOk: makeCi?.ok ?? null,
    ciSkipped: skipCi,
    failures: failures.length,
  });

  return { attempt, writePolicy, regression, makeCi, ciOnlyFailure };
}

export async function runVerifyPhase(
  task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  const input = task.input as unknown as VerifyInput;
  const worktreePath = worktreePathFor(cfg.worktreeBase, input.issueNumber);

  // Fast path: fix phase reported BLOCKED — no checks to run.
  if (input.blocked) {
    const reason = input.blockedReason ?? "fix agent blocked";
    const blockedAttempt: AttemptRecord = {
      attempt: 1,
      diffPaths: [],
      writePolicyOk: false,
      regressionOk: false,
      makeCiOk: null,
      makeCiExitCode: null,
      makeCiDurationMs: 0,
      failures: [`fix-blocked: ${reason}`],
    };
    return {
      output: {
        ok: false,
        writePolicy: { ok: false, hard: [], soft: [] },
        regressionTest: { ok: false, testFiles: [] },
        makeCi: { ok: false, exitCode: null, durationMs: 0 },
        softBanTouched: [],
        diffPaths: [],
        failures: blockedAttempt.failures,
        attempts: [blockedAttempt],
        fixAttemptsUsed: 1,
        worktreePath,
      } as VerifyOutput,
    };
  }

  if (!input.committed) {
    const noCommit: AttemptRecord = {
      attempt: 1,
      diffPaths: [],
      writePolicyOk: false,
      regressionOk: false,
      makeCiOk: null,
      makeCiExitCode: null,
      makeCiDurationMs: 0,
      failures: ["no commit on the bug branch (fix agent did not commit)"],
    };
    return {
      output: {
        ok: false,
        writePolicy: { ok: false, hard: [], soft: [] },
        regressionTest: { ok: false, testFiles: [] },
        makeCi: { ok: false, exitCode: null, durationMs: 0 },
        softBanTouched: [],
        diffPaths: [],
        failures: noCommit.failures,
        attempts: [noCommit],
        fixAttemptsUsed: 1,
        worktreePath,
      } as VerifyOutput,
    };
  }

  // The retry loop: run all checks. If make-ci is the SOLE failure and fix-retries
  // remain, re-invoke the fix agent with the failure log appended to handoff, then
  // re-run all checks. Repeat up to `cfg.fixRetries` times.
  const attempts: AttemptRecord[] = [];
  const handoffDir = path.resolve(ctx.outputDir, "..", "write-handoff");
  // Note: `cfg.fixRetries` counts ADDITIONAL fix attempts beyond the initial one.
  // attempt 1 = initial fix (already done in fix phase). retries 1..fixRetries = more.
  const maxAttempts = 1 + Math.max(0, cfg.fixRetries);
  let attemptNumber = 1;

  // Initial check pass against the first-fix diff.
  let checks = await runAllChecks({ worktreePath, cfg, ctx, attemptNumber });
  attempts.push(checks.attempt);

  while (!checks.attempt.failures.length || checks.ciOnlyFailure) {
    if (checks.attempt.failures.length === 0) break; // all good
    if (attemptNumber >= maxAttempts) break;          // out of retries
    if (!checks.ciOnlyFailure) break;                 // failure isn't CI-fixable

    // 1. Append the failing make-ci output to handoff.md so the next fix attempt sees it.
    const prior = await readHandoff(handoffDir);
    if (prior && checks.makeCi) {
      const updated = appendAttemptFailure(
        prior,
        attemptNumber,
        `STDOUT (tail)\n${checks.makeCi.stdoutTail}\n\nSTDERR (tail)\n${checks.makeCi.stderrTail}`,
        "The previous fix attempt did not make `make ci` green. Inspect the failure above and adjust your patch.",
      );
      await writeHandoff(handoffDir, updated);
    }

    // 2. Re-invoke the fix agent in the same worktree (it commits on top of prior commits).
    const newHandoff = (await readHandoff(handoffDir)) ?? "";
    ctx.log("fix-retry-starting", { nextAttempt: attemptNumber + 1 });
    const fix = await runFix({
      worktreePath,
      handoffBody: newHandoff,
      issueNumber: input.issueNumber,
    });
    // Persist retry artifacts.
    await fs.writeFile(
      path.join(ctx.outputDir, `fix-agent-output-attempt-${attemptNumber + 1}.txt`),
      fix.raw,
      "utf-8",
    );
    if (fix.blocked) {
      attemptNumber++;
      attempts.push({
        attempt: attemptNumber,
        diffPaths: fix.diffPaths,
        writePolicyOk: false,
        regressionOk: false,
        makeCiOk: null,
        makeCiExitCode: null,
        makeCiDurationMs: 0,
        failures: [`fix-blocked: ${fix.blockedReason ?? "unknown"}`],
      });
      break;
    }
    if (!fix.committed) {
      attemptNumber++;
      attempts.push({
        attempt: attemptNumber,
        diffPaths: fix.diffPaths,
        writePolicyOk: false,
        regressionOk: false,
        makeCiOk: null,
        makeCiExitCode: null,
        makeCiDurationMs: 0,
        failures: ["retry did not commit"],
      });
      break;
    }

    // 3. Re-run all checks against the new diff.
    attemptNumber++;
    checks = await runAllChecks({ worktreePath, cfg, ctx, attemptNumber });
    attempts.push(checks.attempt);
  }

  // Compose output from the FINAL attempt.
  const final = attempts[attempts.length - 1];
  const ok = final.failures.length === 0;

  // Pull writePolicy + softBanTouched from the final attempt's diff (we don't keep the
  // structured object on AttemptRecord, so re-derive cheaply).
  const finalWritePolicy = scanWritePolicy(final.diffPaths, cfg.writePolicy.hardBan, cfg.writePolicy.softBan);
  const finalRegression = cfg.requireRegressionTest
    ? checkRegressionTests(final.diffPaths)
    : { ok: true, testFiles: [] as string[] };
  const finalMakeCi = {
    ok: final.makeCiOk === true,
    exitCode: final.makeCiExitCode,
    durationMs: final.makeCiDurationMs,
  };

  const out: VerifyOutput = {
    ok,
    writePolicy: finalWritePolicy,
    regressionTest: finalRegression,
    makeCi: finalMakeCi,
    softBanTouched: finalWritePolicy.soft,
    diffPaths: final.diffPaths,
    failures: final.failures,
    attempts,
    fixAttemptsUsed: attemptNumber,
    worktreePath,
  };
  await fs.writeFile(path.join(ctx.outputDir, "verify.json"), JSON.stringify(out, null, 2), "utf-8");

  ctx.log("verify-done", {
    ok,
    fixAttemptsUsed: attemptNumber,
    finalFailures: final.failures.length,
    soft: finalWritePolicy.soft.length,
  });

  return { output: out };
}

/** Deterministic gate: pass iff verify.ok is true. */
export async function checkVerify(task: Task): Promise<GateCheckResult> {
  const out = task.output as VerifyOutput | undefined;
  if (!out) return { pass: false, reason: "verify produced no output" };
  if (out.ok) return { pass: true };
  const reason = out.failures.join(" | ");
  return { pass: false, reason };
}
