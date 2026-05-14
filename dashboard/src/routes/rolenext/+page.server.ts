import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG } from "../../../../pipelines/rolenext/bug-resolver/pipeline.config.ts";

const BUG_RESOLVER_ID = "rolenext-bug-resolver";

export async function load() {
  const tasks = await listTasksByPipeline(BUG_RESOLVER_ID);
  const active = tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "running" ||
      t.status === "needs_review" ||
      t.status === "paused_backpressure",
  ).length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed" || t.status === "cleared_stale").length;

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
        repo: ROLENEXT_BUG_RESOLVER_CONFIG.repo,
        enableBrowserRepro: ROLENEXT_BUG_RESOLVER_CONFIG.enableBrowserRepro,
        counts: { active, completed, failed, total: tasks.length },
      },
    ],
  };
}
