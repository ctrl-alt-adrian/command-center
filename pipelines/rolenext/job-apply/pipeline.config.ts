import type { PipelineConfig } from "../../../core/lib/types.ts";
import { runDiscover } from "./phases/discover.ts";
import { runSelect, fanOutSelect } from "./phases/select.ts";
import { runPrep, checkPrep } from "./phases/prep.ts";
import { runMarkApplied } from "./phases/mark-applied.ts";

export const rolenextJobApplyPipeline: PipelineConfig = {
  id: "rolenext-job-apply",
  description:
    "Bulk job-application prep against the rolenext API. Discover phase pulls the latest resume's " +
    "suggested titles, runs /api/analyze per title with remoteOnly + full-time/contract, dedupes by URL, " +
    "and ranks by opportunity score. Select gates the top 50 for captain approval, then fans out one prep " +
    "task per job (save → optimize → cover-letter → download both PDFs). Mark-applied gates a per-job " +
    "PATCH to status=applied after the captain submits the application externally. Auth: ROLENEXT_JWT env " +
    "(see lib/api-client.ts for how to extract from a logged-in browser).",
  backpressureCap: 5,
  // Sequential per task; LLM calls dominate. Cap concurrency low so a single
  // 50-job fan-out doesn't slam the rolenext rate limiter (5 req/s burst 15).
  perTickCap: 3,
  // First batch goes pending; rest stay paused_user so the captain can pace
  // optimize-budget spend across the day.
  fanOutBatchSize: 10,
  phases: [
    {
      id: "discover",
      gateType: "auto_pass",
      // analyze across up to 6 keywords, each ~20-60s on cold cache.
      timeoutMs: 15 * 60_000,
      run: runDiscover,
    },
    {
      id: "select",
      gateType: "needs_review",
      timeoutMs: 60_000,
      run: runSelect,
      fanOut: fanOutSelect,
    },
    {
      id: "prep",
      gateType: "deterministic",
      // save (fast) + optimize (~30-60s LLM) + cover (~30-60s LLM) + 2 PDFs.
      timeoutMs: 8 * 60_000,
      retryPolicy: { maxAttempts: 2 },
      run: runPrep,
      check: checkPrep,
    },
    {
      id: "mark-applied",
      gateType: "needs_review",
      timeoutMs: 60_000,
      run: runMarkApplied,
    },
  ],
};
