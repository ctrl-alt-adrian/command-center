import { json } from "@sveltejs/kit";
import { listTasks } from "../../../../../../core/lib/tasks.ts";
import { rerunTask } from "../../../../../../core/lib/processor.ts";
import type { Task } from "../../../../../../core/lib/types.ts";

/**
 * POST /api/tasks/rerun
 * Body: { pipelineId?: string }
 *
 * Re-queues every `failed` task (optionally scoped to one pipeline) by
 * flipping status → pending, clearing error, resetting retryCount.
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as { pipelineId?: string };
  const all = await listTasks();
  const targets = all.filter((t: Task) => {
    if (t.status !== "failed") return false;
    if (body.pipelineId && t.pipelineId !== body.pipelineId) return false;
    return true;
  });

  const ids: string[] = [];
  for (const t of targets) {
    const result = await rerunTask(t.id);
    if (result) ids.push(result.id);
  }

  return json({ rerun: ids.length, ids, filter: { pipelineId: body.pipelineId ?? null } });
}
