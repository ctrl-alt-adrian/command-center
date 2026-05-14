import { error } from "@sveltejs/kit";
import { getKBEntry } from "../../../../../../pipelines/marketing/lib/kb.ts";

export async function load({ params }) {
  const entry = await getKBEntry(params.id);
  if (!entry) throw error(404, `KB entry not found: ${params.id}`);
  return { entry };
}
