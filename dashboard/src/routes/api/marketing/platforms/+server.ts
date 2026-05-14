import { json, error } from "@sveltejs/kit";
import {
  getPlatformConfig,
  setDisabledPlatforms,
} from "../../../../../../pipelines/marketing/lib/config.ts";
import { PLATFORMS } from "../../../../../../pipelines/marketing/lib/constants.ts";

export async function GET() {
  const cfg = await getPlatformConfig();
  return json({ enabled: cfg.enabled, disabled: cfg.disabled, all: PLATFORMS });
}

export async function POST({ request }) {
  const body = (await request.json().catch(() => ({}))) as { disabled?: unknown };
  if (!Array.isArray(body.disabled)) throw error(400, "disabled must be an array");
  await setDisabledPlatforms(body.disabled.map(String));
  const cfg = await getPlatformConfig();
  return json({ enabled: cfg.enabled, disabled: cfg.disabled });
}
