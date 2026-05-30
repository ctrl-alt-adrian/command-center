import { json } from "@sveltejs/kit";
import { listTasks, clearFailureAttempts } from "../../../../../../core/lib/tasks.ts";
import type { Task } from "../../../../../../core/lib/types.ts";

/**
 * POST /api/tasks/clear-failures
 * Body: { pipelineId?: string }
 *
 * Strips `error` + `gate_fail` entries from the attempts log of every task
 * (optionally scoped to a pipeline) so the Failures panel goes quiet.
 * Successful `ok` entries are preserved. Doesn't change task status — use
 * rerun-gate / rerun for that. Designed for the bulk "clear failures" button.
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as { pipelineId?: string };
  const all = await listTasks();
  const targets = all.filter((t: Task) => {
    if (body.pipelineId && t.pipelineId !== body.pipelineId) return false;
    return (t.attempts ?? []).some((a) => a.outcome === "error" || a.outcome === "gate_fail");
  });

  let totalRemoved = 0;
  const ids: string[] = [];
  for (const t of targets) {
    const removed = await clearFailureAttempts(t.id);
    if (removed > 0) {
      totalRemoved += removed;
      ids.push(t.id);
    }
  }

  return json({ cleared: ids.length, attemptsRemoved: totalRemoved, ids, filter: { pipelineId: body.pipelineId ?? null } });
}
