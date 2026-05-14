import type { PipelineConfig } from "../../../core/lib/types.ts";
import { runPollIssues, fanOutPollIssues } from "./phases/poll-issues.ts";
import { runTriage, checkTriage } from "./phases/triage.ts";
import { runWriteHandoff } from "./phases/write-handoff.ts";
import { runFixPhase } from "./phases/fix.ts";
import { runVerifyPhase, checkVerify } from "./phases/verify.ts";
import { runPrPhase } from "./phases/pr.ts";
import { runPostMortemPhase } from "./phases/post-mortem.ts";

export interface RolenextWritePolicy {
  hardBan: string[];
  softBan: string[];
}

export interface RolenextCaps {
  maxTicketsPerDay: number;
  maxQueueDepth: number;
  ticketStaleAfterDays: number;
  concurrency: number;
}

export interface RolenextBugResolverConfig {
  repo: string;
  rolenextPath: string;
  worktreeBase: string;
  enableBrowserRepro: boolean;
  reproTarget: "none" | "worktree-dev" | "prod";
  caps: RolenextCaps;
  triageThreshold: number;
  writePolicy: RolenextWritePolicy;
  requireRegressionTest: boolean;
  fixRetries: number;
  killSwitchFile: string;
}

export const ROLENEXT_BUG_RESOLVER_CONFIG: RolenextBugResolverConfig = {
  repo: "ctrl-alt-adrian/rolenext",
  rolenextPath: "/home/adrian/Developer/projects/rolenext",
  worktreeBase: "/home/adrian/Developer/projects/.worktrees",
  enableBrowserRepro: false,
  reproTarget: "none",
  caps: {
    maxTicketsPerDay: 5,
    maxQueueDepth: 20,
    ticketStaleAfterDays: 7,
    concurrency: 1,
  },
  triageThreshold: 0.7,
  writePolicy: {
    hardBan: ["*.env", "*.env.*", "backend/db/migrations/**", ".github/**"],
    softBan: [
      "specs/**",
      "docker-compose.yml",
      "Makefile",
      "package.json",
      "pnpm-lock.yaml",
      "go.mod",
      "go.sum",
      "go.work*",
      "frontend/vite.config.ts",
      "frontend/vitest.config.ts",
    ],
  },
  requireRegressionTest: true,
  fixRetries: 2,
  killSwitchFile: ".disabled",
};

export const rolenextBugResolverPipeline: PipelineConfig = {
  id: "rolenext-bug-resolver",
  description:
    "Autonomous pipeline: polls open GitHub Issues on rolenext, triages each (code-investigation only in v1), " +
    "writes a handoff, attempts a fix in an isolated worktree branched from origin/main, verifies it (write-policy " +
    "diff scan + regression-test presence + make ci), opens a draft PR for the captain to review and merge, then " +
    "writes a structured post-mortem to vault/incidents/.",
  backpressureCap: 5,
  // Independent per-tick budget so the resolver isn't starved by the global
  // pool when other pipelines (e.g. marketing with many pending tasks) saturate
  // the default cap.
  perTickCap: 5,
  cronSchedule: "*/15 * * * *",
  phases: [
    {
      id: "poll-issues",
      gateType: "auto_pass",
      timeoutMs: 5 * 60_000,
      run: async (task, ctx) => await runPollIssues(task, ctx),
      fanOut: fanOutPollIssues,
    },
    {
      id: "triage",
      gateType: "deterministic",
      timeoutMs: 15 * 60_000,
      retryPolicy: { maxAttempts: 1 },
      run: async (task, ctx) => await runTriage(task, ctx),
      check: checkTriage,
    },
    {
      id: "write-handoff",
      gateType: "auto_pass",
      timeoutMs: 60_000,
      run: async (task, ctx) => await runWriteHandoff(task, ctx),
    },
    {
      id: "fix",
      gateType: "auto_pass",
      timeoutMs: 50 * 60_000,
      run: async (task, ctx) => await runFixPhase(task, ctx),
    },
    {
      id: "verify",
      gateType: "deterministic",
      // Worst case: 1 + fixRetries fix invocations + (1 + fixRetries) ci runs.
      // With fixRetries=2 and 45-min fix + 20-min ci: ~195 min upper bound.
      // Most fixes pass on attempt 1 so typical is ~15-30 min.
      timeoutMs: 210 * 60_000,
      // The fix-retry loop is owned by verify.run() itself — when `make ci` is
      // the sole failure, verify appends the failure log to handoff and
      // re-invokes the fix agent in-place. The processor's retry-in-place is
      // unused (it re-dispatches the same phase against the same diff, which
      // is useless here), so maxAttempts stays at 1.
      retryPolicy: { maxAttempts: 1 },
      run: async (task, ctx) => await runVerifyPhase(task, ctx),
      check: checkVerify,
    },
    {
      id: "pr",
      gateType: "auto_pass",
      timeoutMs: 5 * 60_000,
      run: async (task, ctx) => await runPrPhase(task, ctx),
    },
    {
      id: "post-mortem",
      gateType: "auto_pass",
      timeoutMs: 5 * 60_000,
      run: async (task, ctx) => await runPostMortemPhase(task, ctx),
    },
  ],
};
