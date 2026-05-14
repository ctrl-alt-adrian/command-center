import { json, error } from "@sveltejs/kit";
import { saveBrandDraft } from "../../../../../../../../pipelines/personal-brand/lib/drafts.ts";

export async function PUT({ params, request }) {
  const body = (await request.json().catch(() => ({}))) as { content?: unknown };
  if (typeof body.content !== "string") throw error(400, "content (string) required");
  await saveBrandDraft(params.slug!, params.platform!, body.content);
  return json({ ok: true });
}
