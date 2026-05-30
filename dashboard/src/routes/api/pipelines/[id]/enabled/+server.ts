import { json, error } from "@sveltejs/kit";
import { setPipelineEnabled, isPipelineEnabled } from "../../../../../../../core/lib/pipelineState.ts";
import { getPipeline } from "../../../../../../../core/lib/registry.ts";

export async function POST({ params, request }) {
  const pipeline = getPipeline(params.id);
  if (!pipeline) throw error(404, `unknown pipeline: ${params.id}`);
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") throw error(400, "enabled (boolean) required");
  await setPipelineEnabled(params.id, body.enabled);
  return json({ id: params.id, enabled: body.enabled });
}

export async function GET({ params }) {
  const enabled = await isPipelineEnabled(params.id);
  return json({ id: params.id, enabled });
}
