import { json, error } from "@sveltejs/kit";
import { rejectTask } from "../../../../../../../core/lib/processor.ts";

export async function POST({ params, request }) {
  const body = await request.json().catch(() => ({}));
  const task = await rejectTask(params.id, body.reason);
  if (!task) throw error(404, "task not found");
  return json({ task });
}
