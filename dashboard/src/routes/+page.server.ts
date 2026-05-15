import { pipelineStatus } from "../../../core/lib/processor.ts";
import { listTasks } from "../../../core/lib/tasks.ts";
import { extractFailures } from "$lib/failures";

export async function load() {
  const [pipelines, tasks] = await Promise.all([pipelineStatus(), listTasks()]);
  const failures = extractFailures(tasks);
  return { pipelines, failures };
}
