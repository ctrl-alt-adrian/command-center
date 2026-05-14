import { error } from "@sveltejs/kit";
import { getTask } from "../../../../../../core/lib/tasks.ts";
import { listStagedCandidates } from "../../../../../../pipelines/vault-nuggets/lib/extract.ts";

export async function load({ params }) {
  const task = await getTask(params.task);
  if (!task) throw error(404, `task not found: ${params.task}`);
  if (task.pipelineId !== "vault-nuggets") throw error(400, `task is not vault-nuggets: ${task.pipelineId}`);

  const staged = await listStagedCandidates(params.task);
  return {
    taskId: params.task,
    taskStatus: task.status,
    candidates: staged.map((s) => ({ file: s.file, status: s.status, candidate: s.candidate })),
  };
}
