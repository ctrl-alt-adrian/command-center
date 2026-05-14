import { json, error } from "@sveltejs/kit";
import { listTasks, deleteTask } from "../../../../../../core/lib/tasks.ts";
import type { TaskStatus, Task } from "../../../../../../core/lib/types.ts";

const ALLOWED: TaskStatus[] = ["failed", "completed", "cleared_stale"];

/**
 * POST /api/tasks/clear
 * Body: { status?: TaskStatus | TaskStatus[], pipelineId?: string }
 *
 * Deletes every task matching the filter. If `status` is omitted, defaults
 * to `failed` only — bulk-removing completed/running by accident would
 * destroy in-flight work.
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as {
    status?: TaskStatus | TaskStatus[];
    pipelineId?: string;
  };

  const wanted: TaskStatus[] = Array.isArray(body.status)
    ? body.status
    : body.status
      ? [body.status]
      : ["failed"];

  for (const s of wanted) {
    if (!ALLOWED.includes(s)) {
      throw error(400, `status "${s}" not allowed for bulk clear; allowed: ${ALLOWED.join(", ")}`);
    }
  }
  const wantedSet = new Set(wanted);

  const all = await listTasks();
  const targets = all.filter((t: Task) => {
    if (!wantedSet.has(t.status)) return false;
    if (body.pipelineId && t.pipelineId !== body.pipelineId) return false;
    return true;
  });

  for (const t of targets) {
    await deleteTask(t.id);
  }

  return json({
    removed: targets.length,
    ids: targets.map((t: Task) => t.id),
    filter: { status: wanted, pipelineId: body.pipelineId ?? null },
  });
}
