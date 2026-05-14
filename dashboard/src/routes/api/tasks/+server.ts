import { json, error } from "@sveltejs/kit";
import { createTask, listTasks } from "../../../../../core/lib/tasks.ts";
import { getPipeline } from "../../../../../core/lib/registry.ts";

export async function GET() {
  const tasks = await listTasks();
  return json({ tasks });
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const pipelineId = body.pipelineId;
  if (!pipelineId || typeof pipelineId !== "string") {
    throw error(400, "pipelineId required");
  }
  const pipeline = getPipeline(pipelineId);
  if (!pipeline) {
    throw error(404, `unknown pipeline: ${pipelineId}`);
  }
  const task = await createTask({
    pipelineId,
    phaseId: pipeline.phases[0].id,
    input: body.input ?? {},
  });
  return json({ task });
}
