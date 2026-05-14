import { json, error } from "@sveltejs/kit";
import { resumePausedUserTasks } from "../../../../../../core/lib/processor.ts";

/**
 * POST /api/tasks/resume
 * Body: { pipelineId?: string, count: number }
 *
 * Flips the next N `paused_user` tasks (oldest createdAt first) back to
 * `pending` so the processor picks them up on the next tick. When pipelineId
 * is omitted, drains across every pipeline.
 */
export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as {
    pipelineId?: string;
    count?: unknown;
  };
  const count = typeof body.count === "number" && Number.isFinite(body.count) ? Math.floor(body.count) : 25;
  if (count <= 0) throw error(400, "count must be a positive integer");

  const result = await resumePausedUserTasks(body.pipelineId, count);
  return json({ ...result, filter: { pipelineId: body.pipelineId ?? null, count } });
}
