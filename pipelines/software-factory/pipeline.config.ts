import type { PipelineConfig } from "../../core/lib/types.ts";
import { runClearStale } from "./lib/clear-stale.ts";

export const softwareFactoryHousekeepingPipeline: PipelineConfig = {
  id: "software-factory-housekeeping",
  description:
    "Daily self-maintenance: clears tasks stuck in paused_backpressure for more than 7 days, " +
    "appends a per-day log to logs/housekeeping/. Proves the multi-domain pattern — first " +
    "non-marketing pipeline registered under software-factory.",
  backpressureCap: 5,
  cronSchedule: "0 3 * * *",
  phases: [
    {
      id: "clear-stale",
      gateType: "auto_pass",
      timeoutMs: 30_000,
      run: async (_task, ctx) => {
        const result = await runClearStale();
        ctx.log("housekeeping done", { scanned: result.scanned, cleared: result.cleared.length });
        return {
          output: {
            scanned: result.scanned,
            cleared: result.cleared.length,
            details: result.cleared as unknown as Record<string, unknown>[],
          },
        };
      },
    },
  ],
};

/** Reserved software-factory pipelines — not registered with core. Shown on /software-factory
 *  to document the planning anchor. */
export interface ReservedPipeline {
  id: string;
  description: string;
}

export const RESERVED_SOFTWARE_FACTORY_PIPELINES: ReservedPipeline[] = [
  {
    id: "spec-to-pr",
    description:
      "Autonomous loop that picks the next pending OpenSpec change with `applyRequires` satisfied, " +
      "implements its tasks.md on a fresh branch, runs project checks, and opens a PR. " +
      "Captain approves the PR via the normal review flow (not via /tasks).",
  },
  {
    id: "test-triage",
    description:
      "Watches CI status. When a flaky test fails twice in a row, opens a needs_review task with " +
      "the failure log + a claude-suggested fix, leaves the actual change to the captain.",
  },
  {
    id: "dep-bump",
    description:
      "Weekly: scans package.json / go.mod / requirements for updates flagged as safe (patch + minor " +
      "with passing changelog scan), bumps + opens a PR per package group. Major bumps go to needs_review.",
  },
];
