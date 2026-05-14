import { createHash } from "crypto";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import type { Task } from "../../../../core/lib/types.ts";
import { loadFingerprints } from "./state.ts";
import type { GitHubIssue, GitHubPR } from "./github.ts";
import { hasLabel } from "./github.ts";

const PIPELINE_ID = "rolenext-bug-resolver";
const TERMINAL_BAD = new Set(["failed", "cleared_stale"]);
const SKIP_LABELS = ["wontfix", "duplicate", "no-bot"];
const FINGERPRINT_WINDOW_DAYS = 14;

export type DedupReason =
  | "layer1-task-exists"
  | "layer2-closed"
  | "layer2-has-pr"
  | "layer2-skip-label"
  | "layer3-fingerprint-match";

export interface DedupSkip {
  skip: true;
  layer: 1 | 2 | 3;
  reason: DedupReason;
  matchedIssueNumber?: number;
  matchedPrUrl?: string | null;
}

export interface DedupAllow {
  skip: false;
  fingerprint: string;
}

export type DedupResult = DedupSkip | DedupAllow;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    let p = u.pathname.replace(/\/+$/, "");
    if (p === "") p = "/";
    return (u.origin + p).toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Compute the dedup fingerprint from pageUrl + first 200 chars of description. */
export function computeFingerprint(pageUrl: string, description: string): string {
  const norm = normalizeUrl(pageUrl) + "::" + normalizeDescription(description).slice(0, 200);
  return createHash("sha256").update(norm).digest("hex");
}

/** Extract a pageUrl from an issue body. The support widget includes it in a known shape;
 *  we look for a line like "Page URL: <url>" or "URL: <url>" (case-insensitive). Fallback empty. */
export function extractPageUrl(body: string): string {
  const m = body.match(/(?:page\s*url|url)\s*:?\s*(https?:\/\/\S+)/i);
  return m ? m[1] : "";
}

/** Layer 1: a task for this issue already exists (and is not in a terminal-bad state). */
async function layer1HasTask(issueNumber: number): Promise<boolean> {
  const tasks = await listTasksByPipeline(PIPELINE_ID);
  return tasks.some((t: Task) => {
    if (TERMINAL_BAD.has(t.status)) return false;
    return (t.input as { issueNumber?: number }).issueNumber === issueNumber;
  });
}

/** Layer 2: GitHub state — closed, has linked PR, or carries a skip label. */
function layer2State(issue: GitHubIssue, openBotPRs: GitHubPR[]): DedupSkip | null {
  if (issue.state === "closed") {
    return { skip: true, layer: 2, reason: "layer2-closed" };
  }
  for (const label of SKIP_LABELS) {
    if (hasLabel(issue, label)) {
      return { skip: true, layer: 2, reason: "layer2-skip-label" };
    }
  }
  // Check if any open bot PR mentions this issue via "Closes #N" / "Fixes #N" in its body.
  const closesPattern = new RegExp(`\\b(?:closes|fixes|resolves)\\s*#${issue.number}\\b`, "i");
  for (const pr of openBotPRs) {
    if (closesPattern.test(pr.body || "")) {
      return { skip: true, layer: 2, reason: "layer2-has-pr", matchedPrUrl: pr.url };
    }
  }
  return null;
}

/** Layer 3: fingerprint match against a recent open/merged PR. */
async function layer3Fingerprint(fp: string): Promise<DedupSkip | null> {
  const store = await loadFingerprints();
  const rec = store[fp];
  if (!rec) return null;
  const ageMs = Date.now() - new Date(rec.seenAt).getTime();
  const maxMs = FINGERPRINT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxMs) return null;
  if (rec.status === "in-flight" || rec.status === "pr-open" || rec.status === "merged") {
    return {
      skip: true,
      layer: 3,
      reason: "layer3-fingerprint-match",
      matchedIssueNumber: rec.issueNumber,
      matchedPrUrl: rec.prUrl,
    };
  }
  return null;
}

export interface DedupContext {
  openBotPRs: GitHubPR[];
}

/** Run all three dedup layers in order. Returns the first skip or `allow`. */
export async function checkDedup(issue: GitHubIssue, ctx: DedupContext): Promise<DedupResult> {
  if (await layer1HasTask(issue.number)) {
    return { skip: true, layer: 1, reason: "layer1-task-exists" };
  }
  const l2 = layer2State(issue, ctx.openBotPRs);
  if (l2) return l2;
  const pageUrl = extractPageUrl(issue.body || "");
  const fp = computeFingerprint(pageUrl, issue.body || "");
  const l3 = await layer3Fingerprint(fp);
  if (l3) return l3;
  return { skip: false, fingerprint: fp };
}

/** Reopen-aware variant: bypass Layer 1 when the issue was reopened. */
export async function checkDedupForReopen(issue: GitHubIssue, ctx: DedupContext): Promise<DedupResult> {
  const l2 = layer2State(issue, ctx.openBotPRs);
  if (l2) return l2;
  const pageUrl = extractPageUrl(issue.body || "");
  const fp = computeFingerprint(pageUrl, issue.body || "");
  // Layer 3 still applies — a fingerprint match means we're chasing the same code, regardless of reopen.
  const l3 = await layer3Fingerprint(fp);
  if (l3) return l3;
  return { skip: false, fingerprint: fp };
}
