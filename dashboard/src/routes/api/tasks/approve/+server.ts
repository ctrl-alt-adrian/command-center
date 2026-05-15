import { json } from "@sveltejs/kit";
import { listTasks } from "../../../../../../core/lib/tasks.ts";
import { approveTask } from "../../../../../../core/lib/processor.ts";
import type { Task } from "../../../../../../core/lib/types.ts";

/**
 * POST /api/tasks/approve
 * Body: { pipelineId?: string }
 *
 * Approves every task currently in `needs_review` (optionally scoped to one
 * pipeline) by advancing it to the next phase via the processor's
 * approveTask().
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as { pipelineId?: string };
  const all = await listTasks();
  const targets = all.filter((t: Task) => {
    if (t.status !== "needs_review") return false;
    if (body.pipelineId && t.pipelineId !== body.pipelineId) return false;
    return true;
  });

  const approved: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const t of targets) {
    try {
      const result = await approveTask(t.id);
      if (result) {
        approved.push(result.id);
      } else {
        failed.push({ id: t.id, reason: "approveTask returned null" });
      }
    } catch (err) {
      failed.push({ id: t.id, reason: (err as Error).message });
    }
  }

  return json({
    approved: approved.length,
    failedCount: failed.length,
    ids: approved,
    failed,
    filter: { pipelineId: body.pipelineId ?? null },
  });
}
