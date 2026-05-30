import { json } from "@sveltejs/kit";
import { listTasks } from "../../../../../../core/lib/tasks.ts";
import { rerunGate } from "../../../../../../core/lib/processor.ts";
import type { Task } from "../../../../../../core/lib/types.ts";

/**
 * POST /api/tasks/rerun-gate
 * Body: { pipelineId?: string; phaseId?: string }
 *
 * Bulk re-runs deterministic gates that exhausted their retry budget.
 * Targets every task in `needs_review` with a non-empty gateFailReason,
 * optionally scoped to a pipeline and/or a phase (e.g. `slop-check`).
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as {
    pipelineId?: string;
    phaseId?: string;
  };
  const all = await listTasks();
  const targets = all.filter((t: Task) => {
    if (t.status !== "needs_review") return false;
    if (!t.gateFailReason) return false;
    if (body.pipelineId && t.pipelineId !== body.pipelineId) return false;
    if (body.phaseId && t.phaseId !== body.phaseId) return false;
    return true;
  });

  const ids: string[] = [];
  for (const t of targets) {
    const result = await rerunGate(t.id);
    if (result) ids.push(result.id);
  }

  return json({
    rerun: ids.length,
    ids,
    filter: { pipelineId: body.pipelineId ?? null, phaseId: body.phaseId ?? null },
  });
}
