import { listTasks } from "../../../../core/lib/tasks.ts";
import { pipelineStatus, readLastProcessorState } from "../../../../core/lib/processor.ts";
import { extractFailures } from "$lib/failures";

export async function load() {
  const [tasks, pipelines, lastProcessor] = await Promise.all([
    listTasks(),
    pipelineStatus(),
    readLastProcessorState(),
  ]);
  const failures = extractFailures(tasks);
  return { tasks, pipelines, lastProcessor, failures };
}
