import { json, error } from "@sveltejs/kit";
import { approveTask } from "../../../../../../../core/lib/processor.ts";

export async function POST({ params }) {
  try {
    const task = await approveTask(params.id);
    if (!task) throw error(404, "task not found or not in needs_review");
    return json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cannot approve past failed")) throw error(409, msg);
    throw err;
  }
}
