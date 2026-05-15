import { loadLatest, listArchive } from "../../../../pipelines/competitors/lib/scrape.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { failedCount } from "$lib/failures";

export async function load() {
  const [snapshot, archive, tasks] = await Promise.all([
    loadLatest().catch(() => null),
    listArchive().catch(() => []),
    listTasksByPipeline("competitors"),
  ]);
  return { snapshot, archive, failedCount: failedCount(tasks) };
}
