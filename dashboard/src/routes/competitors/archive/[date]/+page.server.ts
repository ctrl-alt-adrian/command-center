import { error } from "@sveltejs/kit";
import { loadByDate } from "../../../../../../pipelines/competitors/lib/scrape.ts";

export async function load({ params }) {
  const snapshot = await loadByDate(params.date);
  if (!snapshot) throw error(404, `no snapshot for ${params.date}`);
  return { snapshot };
}
