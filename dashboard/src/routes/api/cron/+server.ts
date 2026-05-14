import { json } from "@sveltejs/kit";
import { runProcessor } from "../../../../../core/lib/processor.ts";

export async function POST() {
  const result = await runProcessor();
  return json(result);
}
