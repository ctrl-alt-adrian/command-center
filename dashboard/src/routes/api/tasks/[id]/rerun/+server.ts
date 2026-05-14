import { json, error } from "@sveltejs/kit";
import { rerunTask } from "../../../../../../../core/lib/processor.ts";

export async function POST({ params }) {
  const task = await rerunTask(params.id);
  if (!task) throw error(404, "task not found or not in failed state");
  return json({ task });
}
