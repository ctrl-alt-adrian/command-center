import { json, error } from "@sveltejs/kit";
import {
  listStagedCandidates,
  recordCandidateDecision,
} from "../../../../../../../../pipelines/vault-nuggets/lib/extract.ts";

/**
 * POST /api/vault/staging/:task/bulk
 * Body: { action: "approve-pending" | "reject-pending" | "approve-all" | "reject-all" }
 *
 * Bulk-decides multiple staged candidates in one request. *-pending only affects
 * candidates without a decision yet; *-all overrides existing decisions too.
 */
export async function POST({ params, request }) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action;
  if (action !== "approve-pending" && action !== "reject-pending" && action !== "approve-all" && action !== "reject-all") {
    throw error(400, "action must be one of: approve-pending, reject-pending, approve-all, reject-all");
  }
  const status: "approved" | "rejected" = action.startsWith("approve") ? "approved" : "rejected";
  const targetsAll = action.endsWith("-all");

  const candidates = await listStagedCandidates(params.task);
  const targets = candidates.filter((c) => (targetsAll ? true : !c.status));
  for (const c of targets) {
    await recordCandidateDecision(params.task, c.file, status);
  }
  return json({ updated: targets.length, status });
}
