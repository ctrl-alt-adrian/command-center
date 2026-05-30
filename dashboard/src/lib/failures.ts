import type { Task, TaskAttempt, TaskStatus } from "../../../core/lib/types.ts";

export interface FailureRow {
  taskId: string;
  pipelineId: string;
  phaseId: string;
  status: string;
  updatedAt: string;
  errorMessage: string;
  attemptCount: number;
  /** Best deep-link to inspect the failure. */
  detailUrl: string;
  /** Optional human label for the source pipeline (e.g. "RoleNext bug resolver"). */
  pipelineLabel: string;
}

const PIPELINE_LABELS: Record<string, string> = {
  "rolenext-bug-resolver": "RoleNext bug resolver",
  "software-factory-housekeeping": "Software factory housekeeping",
  marketing: "Marketing",
  "vault-nuggets": "Vault nuggets",
  competitors: "Competitors",
  "reddit-pmf": "Reddit PMF",
  "reddit-pmf-metrics": "Reddit PMF metrics",
  "personal-brand": "Personal brand",
};

const PIPELINE_DETAIL_ROUTES: Record<string, (id: string) => string> = {
  "rolenext-bug-resolver": (id) => `/rolenext/bug-resolver/${id}`,
};

function detailUrlFor(pipelineId: string, taskId: string): string {
  const builder = PIPELINE_DETAIL_ROUTES[pipelineId];
  if (builder) return builder(taskId);
  return `/tasks/${taskId}`;
}

function labelFor(pipelineId: string): string {
  return PIPELINE_LABELS[pipelineId] ?? pipelineId;
}

/** Inspect ONLY the most recent attempt. If it's a failure, surface it.
 *  If a later attempt succeeded (e.g. the task was rewound and retried
 *  successfully), the task isn't currently failing and shouldn't show in
 *  the Failures panel as noise. */
function latestAttemptFailure(attempts: TaskAttempt[]): { outcome: string; reason: string } | null {
  if (attempts.length === 0) return null;
  const last = attempts[attempts.length - 1];
  if ((last.outcome === "error" || last.outcome === "gate_fail") && last.reason) {
    return { outcome: last.outcome, reason: last.reason };
  }
  return null;
}

/**
 * Surface every task that warrants a "what went wrong here?" callout:
 *  - status `failed` or `cleared_stale` (explicit terminal failure)
 *  - any task with at least one attempt whose outcome is `error` (even if the
 *    processor later retried and recovered — we still want a record)
 *
 * Pure transformation — no I/O, callers pass in the task list.
 */
export function extractFailures(tasks: Task[]): FailureRow[] {
  const rows: FailureRow[] = [];
  for (const t of tasks) {
    // Completed tasks may carry historical gate_fail attempts that retried to
    // success; surfacing them as "failures" is noise — the work is done.
    if (t.status === "completed") continue;
    const terminal = t.status === "failed" || t.status === "cleared_stale";
    const lastFailure = latestAttemptFailure(t.attempts ?? []);
    if (!terminal && !lastFailure) continue;

    const errorMessage =
      t.error ||
      (terminal && t.gateFailReason) ||
      lastFailure?.reason ||
      t.gateFailReason ||
      "(no error message recorded)";

    const attemptCount = (t.attempts ?? []).filter(
      (a) => a.outcome === "error" || a.outcome === "gate_fail",
    ).length;

    rows.push({
      taskId: t.id,
      pipelineId: t.pipelineId,
      phaseId: t.phaseId,
      status: t.status,
      updatedAt: t.updatedAt,
      errorMessage,
      attemptCount,
      detailUrl: detailUrlFor(t.pipelineId, t.id),
      pipelineLabel: labelFor(t.pipelineId),
    });
  }
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows;
}

export interface FailureSummary {
  total: number;
  terminal: number;     // status = failed / cleared_stale
  recovered: number;    // had error attempts but ended in a non-failure state
  byPipeline: Record<string, number>;
}

/** Tally tasks by status. Missing statuses default to 0 so callers can index without checks. */
export function countTasksByStatus(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    running: 0,
    pending: 0,
    paused_user: 0,
    paused_backpressure: 0,
    needs_review: 0,
    failed: 0,
    completed: 0,
    cleared_stale: 0,
  };
  for (const t of tasks) counts[t.status]++;
  return counts;
}

/** Sum of statuses callers commonly treat as "needs human attention" failures. */
export function failedCount(tasks: Task[]): number {
  let n = 0;
  for (const t of tasks) if (t.status === "failed" || t.status === "cleared_stale") n++;
  return n;
}

export function summarizeFailures(rows: FailureRow[]): FailureSummary {
  const summary: FailureSummary = {
    total: rows.length,
    terminal: 0,
    recovered: 0,
    byPipeline: {},
  };
  for (const r of rows) {
    if (r.status === "failed" || r.status === "cleared_stale") summary.terminal++;
    else summary.recovered++;
    summary.byPipeline[r.pipelineId] = (summary.byPipeline[r.pipelineId] ?? 0) + 1;
  }
  return summary;
}
