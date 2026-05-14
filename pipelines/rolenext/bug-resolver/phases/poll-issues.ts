import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { createTask, listTasksByPipeline, updateTask } from "../../../../core/lib/tasks.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG, type RolenextBugResolverConfig } from "../pipeline.config.ts";
import {
  listOpenIssues,
  listOpenPRs,
  labelIssue,
  isReopened,
  getPRComments,
  getPRReviews,
  type GitHubIssue,
  type GitHubPR,
} from "../lib/github.ts";
import { checkDedup, checkDedupForReopen, extractPageUrl } from "../lib/dedup.ts";
import {
  killSwitchActive,
  readDailyCount,
  incrementDailyCount,
  upsertFingerprint,
  pruneFingerprints,
} from "../lib/state.ts";

const PIPELINE_ID = "rolenext-bug-resolver";
const SENTINEL_QUEUE_OVERFLOW = "queue overflow";
const REOPEN_ATTEMPT_LIMIT = 3;
const REOPEN_LIMIT_REASON = "reopen attempt limit exceeded";
const STALE_REASON = "queued > 7 days, bot bandwidth";

/** Input for a single child triage task. Returned in `output.candidates`
 *  and emitted one-per-element by `fanOut`. */
export interface TriageCandidate extends Record<string, unknown> {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueBody: string;
  pageUrl: string;
  fingerprint: string;
  attempt: number;
  mode: "open";
  priorPrUrl: string | null;
  forceNeedsReview: boolean;
  forceReason: string | null;
}

interface PollOutput extends Record<string, unknown> {
  scanned: number;
  candidates: TriageCandidate[];
  skipped: { issueNumber: number; layer: number; reason: string }[];
  deferred: number[];
  reopened: number[];
  staleEscalated: string[];
  queueOverflow: boolean;
  killSwitchActive: boolean;
  fingerprintsPruned: number;
  revisionsSpawned: { prNumber: number; issueNumber: number }[];
}

/** For each open bot-PR, check if reviewer activity is more recent than the bot's last
 *  push and (if so) spawn a fix-revision task. Layer-1 dedup prevents duplicates. */
async function detectAndSpawnRevisions(
  openBotPRs: GitHubPR[],
  repo: string,
  ctx: PhaseContext,
): Promise<{ prNumber: number; issueNumber: number }[]> {
  const spawned: { prNumber: number; issueNumber: number }[] = [];
  const existing = await listTasksByPipeline(PIPELINE_ID);

  for (const pr of openBotPRs) {
    // Extract the issue number from `Closes #N` in the PR body (any case).
    const m = (pr.body || "").match(/(?:closes|fixes|resolves)\s*#(\d+)/i);
    if (!m) continue;
    const issueNumber = Number(m[1]);

    // Layer-1 dedup keyed on (prNumber, mode=revision).
    const alreadyHasRevision = existing.some((t) => {
      const inp = t.input as { prNumber?: number; mode?: string };
      const live = t.status === "pending" || t.status === "running";
      return live && inp.prNumber === pr.number && inp.mode === "revision";
    });
    if (alreadyHasRevision) continue;

    // Find the most-recent reviewer activity on this PR (comments + reviews).
    let latestReviewerActivity: string | null = null;
    try {
      const [comments, reviews] = await Promise.all([
        getPRComments(repo, pr.number),
        getPRReviews(repo, pr.number),
      ]);
      for (const c of comments) {
        if (c.user.login.endsWith("[bot]")) continue;
        if (!latestReviewerActivity || c.updated_at > latestReviewerActivity) {
          latestReviewerActivity = c.updated_at;
        }
      }
      for (const r of reviews) {
        if (r.user.login.endsWith("[bot]")) continue;
        if (r.submitted_at && (!latestReviewerActivity || r.submitted_at > latestReviewerActivity)) {
          latestReviewerActivity = r.submitted_at;
        }
      }
    } catch (err) {
      ctx.log("pr-review-fetch-failed", { prNumber: pr.number, error: (err as Error).message });
      continue;
    }

    if (!latestReviewerActivity) continue;

    // Compare against the PR's HEAD commit timestamp (which is the bot's last push,
    // since the bot is the only one committing to bug/* branches). The `headRefOid`
    // field doesn't carry a timestamp directly — use `updatedAt` on the PR as a
    // proxy (it bumps on every commit push). If reviewer activity is strictly later,
    // we have new work to address.
    // Note: this is a heuristic — GitHub also bumps `updatedAt` on label/assign
    // events. Conservative fallback: if reviewer activity is anywhere in the last
    // 24h AND newer than `pr.updatedAt`, spawn a revision.
    if (latestReviewerActivity <= pr.updatedAt) continue;

    await createTask({
      pipelineId: PIPELINE_ID,
      phaseId: "fix",
      input: {
        issueNumber,
        prNumber: pr.number,
        mode: "revision",
        reviewerNote: "",
      },
    });
    spawned.push({ prNumber: pr.number, issueNumber });
    ctx.log("revision-task-spawned", { prNumber: pr.number, issueNumber, latestReviewerActivity });
  }

  return spawned;
}

function countActive(tasks: Task[]): number {
  return tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "running" ||
      t.status === "needs_review" ||
      t.status === "paused_backpressure",
  ).length;
}

async function escalateStale(tasks: Task[], staleAfterDays: number): Promise<string[]> {
  const cutoff = Date.now() - staleAfterDays * 24 * 60 * 60 * 1000;
  const escalated: string[] = [];
  for (const t of tasks) {
    if (t.status !== "pending") continue;
    if (new Date(t.createdAt).getTime() < cutoff) {
      await updateTask(t.id, { status: "needs_review", gateFailReason: STALE_REASON });
      escalated.push(t.id);
    }
  }
  return escalated;
}

function hasOpenSentinel(tasks: Task[]): boolean {
  return tasks.some(
    (t) =>
      (t.input as { sentinel?: string }).sentinel === SENTINEL_QUEUE_OVERFLOW &&
      (t.status === "needs_review" || t.status === "pending"),
  );
}

async function buildCandidate(
  issue: GitHubIssue,
  fingerprint: string,
  attempt: number,
  priorPrUrl: string | null,
  forceNeedsReview: boolean,
  forceReason: string | null,
): Promise<TriageCandidate> {
  return {
    issueNumber: issue.number,
    issueUrl: issue.url,
    issueTitle: issue.title,
    issueBody: issue.body,
    pageUrl: extractPageUrl(issue.body || ""),
    fingerprint,
    attempt,
    mode: "open",
    priorPrUrl,
    forceNeedsReview,
    forceReason,
  };
}

export async function runPollIssues(
  _task: Task,
  ctx: PhaseContext,
  cfg: RolenextBugResolverConfig = ROLENEXT_BUG_RESOLVER_CONFIG,
): Promise<PhaseOutput> {
  const output: PollOutput = {
    scanned: 0,
    candidates: [],
    skipped: [],
    deferred: [],
    reopened: [],
    staleEscalated: [],
    queueOverflow: false,
    killSwitchActive: false,
    fingerprintsPruned: 0,
    revisionsSpawned: [],
  };

  if (await killSwitchActive(cfg.killSwitchFile)) {
    output.killSwitchActive = true;
    ctx.log("kill-switch-active", { file: cfg.killSwitchFile });
    return { output };
  }

  output.fingerprintsPruned = await pruneFingerprints(14);

  const tasksBefore = await listTasksByPipeline(PIPELINE_ID);
  output.staleEscalated = await escalateStale(tasksBefore, cfg.caps.ticketStaleAfterDays);
  const tasksAfter = await listTasksByPipeline(PIPELINE_ID);

  const dailyUsed = await readDailyCount();
  let remainingDaily = Math.max(0, cfg.caps.maxTicketsPerDay - dailyUsed);
  let activeCount = countActive(tasksAfter);

  let issues: GitHubIssue[];
  let openBotPRs: GitHubPR[];
  try {
    [issues, openBotPRs] = await Promise.all([
      listOpenIssues(cfg.repo, { limit: 100 }),
      listOpenPRs(cfg.repo, { labels: ["bot-fix"], limit: 100 }),
    ]);
  } catch (err) {
    ctx.log("github-fetch-failed", { error: (err as Error).message });
    return { output };
  }
  output.scanned = issues.length;

  for (const issue of issues) {
    // Daily cap → defer + label, no candidate created.
    if (remainingDaily <= 0) {
      await labelIssue(cfg.repo, issue.number, ["bot-deferred"]).catch(() => undefined);
      output.deferred.push(issue.number);
      continue;
    }
    // Queue cap → set overflow flag, stop processing more issues this run.
    if (activeCount >= cfg.caps.maxQueueDepth) {
      output.queueOverflow = true;
      break;
    }

    const reopened = isReopened(issue);
    const dedup = reopened
      ? await checkDedupForReopen(issue, { openBotPRs })
      : await checkDedup(issue, { openBotPRs });

    if (dedup.skip) {
      output.skipped.push({ issueNumber: issue.number, layer: dedup.layer, reason: dedup.reason });
      if (dedup.layer === 3 && dedup.matchedIssueNumber) {
        await labelIssue(cfg.repo, issue.number, [
          "bot-skipped",
          `duplicate-of-${dedup.matchedIssueNumber}`,
        ]).catch(() => undefined);
      }
      continue;
    }

    let attempt = 1;
    let priorPrUrl: string | null = null;
    if (reopened) {
      const allForIssue = (await listTasksByPipeline(PIPELINE_ID))
        .filter((t) => (t.input as { issueNumber?: number }).issueNumber === issue.number)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const prior = allForIssue[0];
      if (prior) {
        attempt = ((prior.input as { attempt?: number }).attempt ?? 1) + 1;
        priorPrUrl = (prior.output as { prUrl?: string } | undefined)?.prUrl ?? null;
      }
      output.reopened.push(issue.number);
    }

    const overLimit = attempt > REOPEN_ATTEMPT_LIMIT;
    const candidate = await buildCandidate(
      issue,
      dedup.fingerprint,
      attempt,
      priorPrUrl,
      overLimit, // forceNeedsReview at fanOut time
      overLimit ? REOPEN_LIMIT_REASON : null,
    );

    output.candidates.push(candidate);

    await upsertFingerprint(dedup.fingerprint, {
      issueNumber: issue.number,
      status: "in-flight",
      prUrl: null,
      seenAt: new Date().toISOString(),
    });

    if (!overLimit) {
      await incrementDailyCount(1);
      remainingDaily--;
      activeCount++;
    }
  }

  if (output.queueOverflow && !hasOpenSentinel(tasksAfter)) {
    await createTask({
      pipelineId: PIPELINE_ID,
      phaseId: "poll-issues",
      input: { sentinel: SENTINEL_QUEUE_OVERFLOW },
      status: "needs_review",
    });
    ctx.log("queue-overflow-sentinel-created", {});
  }

  // Auto-detect PR review activity → spawn revision tasks.
  output.revisionsSpawned = await detectAndSpawnRevisions(openBotPRs, cfg.repo, ctx);

  ctx.log("poll-issues-done", {
    scanned: output.scanned,
    candidates: output.candidates.length,
    skipped: output.skipped.length,
    deferred: output.deferred.length,
    reopened: output.reopened.length,
    staleEscalated: output.staleEscalated.length,
    queueOverflow: output.queueOverflow,
    fingerprintsPruned: output.fingerprintsPruned,
    revisionsSpawned: output.revisionsSpawned.length,
  });

  return { output };
}

/** Read the candidates from the completed poll-issues task output and emit
 *  one element per surviving issue. The processor creates one child triage
 *  task per element via `advanceOrComplete`'s fanOut path. */
export async function fanOutPollIssues(task: Task): Promise<Array<Record<string, unknown>>> {
  const out = task.output as PollOutput | undefined;
  if (!out || !Array.isArray(out.candidates)) return [];
  return out.candidates.map((c) => ({ ...c }));
}

/** Post-fanOut: for any child triage task whose candidate had `forceNeedsReview`,
 *  flip it to needs_review with the recorded reason. Called as a side-effect by
 *  the triage phase when it sees `input.forceNeedsReview === true`. (Implemented
 *  here as a helper so the triage phase can stay tight.) */
export async function applyForceNeedsReviewIfRequested(task: Task): Promise<boolean> {
  const force = (task.input as { forceNeedsReview?: boolean }).forceNeedsReview === true;
  if (!force) return false;
  const reason = (task.input as { forceReason?: string }).forceReason ?? REOPEN_LIMIT_REASON;
  await updateTask(task.id, { status: "needs_review", gateFailReason: reason });
  return true;
}
