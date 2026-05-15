import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG } from "../../../../pipelines/rolenext/bug-resolver/pipeline.config.ts";
import { countTasksByStatus } from "$lib/failures";
import type { Task } from "../../../../core/lib/types.ts";

const BUG_RESOLVER_ID = "rolenext-bug-resolver";
const JOB_APPLY_ID = "rolenext-job-apply";

export async function load() {
  const [bugTasks, applyTasks] = await Promise.all([
    listTasksByPipeline(BUG_RESOLVER_ID),
    listTasksByPipeline(JOB_APPLY_ID),
  ]);

  return {
    pipelines: [
      {
        id: BUG_RESOLVER_ID,
        slug: "bug-resolver",
        name: "Bug resolver",
        description:
          "Polls open GitHub issues on rolenext, triages each (investigate-only in v1), attempts a fix in an " +
          "isolated worktree, verifies it, and opens a draft PR for review.",
        cronSchedule: "*/15 * * * *",
        meta: `repo ${ROLENEXT_BUG_RESOLVER_CONFIG.repo} · browser repro: ${ROLENEXT_BUG_RESOLVER_CONFIG.enableBrowserRepro ? "on" : "off"}`,
        counts: summarize(bugTasks),
      },
      {
        id: JOB_APPLY_ID,
        slug: "job-apply",
        name: "Job apply",
        description:
          "Bulk job-application prep against the rolenext API. Discover top candidates from the latest resume's " +
          "suggested titles → review and approve → fan out per-job (save → optimize → cover letter → download " +
          "PDFs) → mark applied after manual submission.",
        cronSchedule: "manual",
        meta: `auth: ROLENEXT_JWT ${process.env.ROLENEXT_JWT ? "set" : "missing"} · base: ${process.env.ROLENEXT_API_BASE ?? "http://localhost:8080"}`,
        counts: summarize(applyTasks),
      },
    ],
  };
}

function summarize(tasks: Task[]) {
  const c = countTasksByStatus(tasks);
  return {
    active: c.pending + c.running + c.needs_review + c.paused_backpressure + c.paused_user,
    completed: c.completed,
    failed: c.failed + c.cleared_stale,
    total: tasks.length,
  };
}
