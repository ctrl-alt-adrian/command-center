import { json, error } from "@sveltejs/kit";
import { disableTask } from "../../../../../../../core/lib/processor.ts";

export async function POST({ params }) {
  const task = await disableTask(params.id);
  if (!task) throw error(404, "task not found");
  return json({ task });
}
