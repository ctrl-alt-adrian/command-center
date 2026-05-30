import { json, error } from "@sveltejs/kit";
import { enableTask } from "../../../../../../../core/lib/processor.ts";

export async function POST({ params }) {
  const task = await enableTask(params.id);
  if (!task) throw error(404, "task not found");
  return json({ task });
}
