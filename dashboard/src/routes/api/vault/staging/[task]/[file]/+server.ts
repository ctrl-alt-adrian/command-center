import { json, error } from "@sveltejs/kit";
import { recordCandidateDecision } from "../../../../../../../../pipelines/vault-nuggets/lib/extract.ts";

export async function POST({ params, request }) {
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (body.status !== "approved" && body.status !== "rejected") {
    throw error(400, "status must be 'approved' or 'rejected'");
  }
  await recordCandidateDecision(params.task, decodeURIComponent(params.file), body.status);
  return json({ ok: true });
}
