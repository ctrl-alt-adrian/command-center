import { json, error } from "@sveltejs/kit";
import { getTask, deleteTask } from "../../../../../../core/lib/tasks.ts";

export async function GET({ params }) {
  const task = await getTask(params.id);
  if (!task) throw error(404, "task not found");
  return json({ task });
}

export async function DELETE({ params }) {
  const task = await getTask(params.id);
  if (!task) throw error(404, "task not found");
  await deleteTask(params.id);
  return json({ removed: params.id });
}
