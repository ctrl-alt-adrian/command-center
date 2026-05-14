import { listTasks } from "../../../../core/lib/tasks.ts";
import { pipelineStatus } from "../../../../core/lib/processor.ts";

export async function load() {
  const [tasks, pipelines] = await Promise.all([listTasks(), pipelineStatus()]);
  return { tasks, pipelines };
}
