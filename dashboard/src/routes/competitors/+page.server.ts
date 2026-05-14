import { loadLatest, listArchive } from "../../../../pipelines/competitors/lib/scrape.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";

export async function load() {
  const [snapshot, archive, tasks] = await Promise.all([
    loadLatest().catch(() => null),
    listArchive().catch(() => []),
    listTasksByPipeline("competitors"),
  ]);
  const failedCount = tasks.filter((t) => t.status === "failed" || t.status === "cleared_stale").length;
  return { snapshot, archive, failedCount };
}
