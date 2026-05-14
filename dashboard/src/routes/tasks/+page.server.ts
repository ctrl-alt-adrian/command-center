import { listTasks } from "../../../../core/lib/tasks.ts";
import { pipelineStatus, readLastProcessorState } from "../../../../core/lib/processor.ts";

export async function load() {
  const [tasks, pipelines, lastProcessor] = await Promise.all([
    listTasks(),
    pipelineStatus(),
    readLastProcessorState(),
  ]);
  return { tasks, pipelines, lastProcessor };
}
