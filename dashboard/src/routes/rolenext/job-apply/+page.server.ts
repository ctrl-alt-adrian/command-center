import fs from "node:fs/promises";
import path from "node:path";
import { listTasksByPipeline } from "../../../../../core/lib/tasks.ts";
import { phaseDir } from "../../../../../core/lib/paths.ts";
import type { Task } from "../../../../../core/lib/types.ts";
import { rolenextJobApplyPipeline } from "../../../../../pipelines/rolenext/job-apply/pipeline.config.ts";
import { extractFailures } from "$lib/failures";

const PIPELINE_ID = "rolenext-job-apply";

export interface PrepRow {
  taskId: string;
  status: string;
  jobId: number | null;
  title: string;
  company: string;
  url: string | null;
  applyMdExists: boolean;
  resumePdfExists: boolean;
  coverPdfExists: boolean;
  appliedTaskId: string | null;
  appliedStatus: string | null;
  updatedAt: string;
}

export interface RunRow {
  discoverId: string;
  createdAt: string;
  updatedAt: string;
  discoverStatus: string;
  selectId: string | null;
  selectStatus: string | null;
  candidateCount: number | null;
  selectedCount: number | null;
  minMatchScore: number | null;
  droppedBelowFloor: number | null;
  reviewMdExists: boolean;
  candidatesMdExists: boolean;
  prep: PrepRow[];
  prepCounts: Record<string, number>;
  appliedCount: number;
}

export async function load() {
  const tasks = await listTasksByPipeline(PIPELINE_ID);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // The processor sets `parentId = task.parentId ?? task.id`, so every
  // descendant of a discover task (select, prep, mark-applied) shares the
  // SAME parentId pointing at the root discover task. Group on root id rather
  // than immediate parent.
  const rootOf = (t: Task) => t.parentId ?? t.id;
  const discoverTasks = tasks.filter((t) => t.phaseId === "discover");
  const runs: RunRow[] = [];

  for (const d of discoverTasks) {
    const inRun = (t: Task) => rootOf(t) === d.id;
    const select = tasks.find((t) => inRun(t) && t.phaseId === "select") ?? null;
    const prepTasks = tasks.filter((t) => inRun(t) && t.phaseId === "prep");
    const markAppliedTasks = tasks.filter((t) => inRun(t) && t.phaseId === "mark-applied");
    // mark-applied → prep linkage is via input.previousTaskId (set by the
    // processor when advancing single-task chains).
    const appliedByPrepId = new Map<string, Task>();
    for (const ma of markAppliedTasks) {
      const prev = (ma.input as { previousTaskId?: string }).previousTaskId;
      if (prev) appliedByPrepId.set(prev, ma);
    }

    const prep: PrepRow[] = await Promise.all(
      prepTasks.map(async (p) => {
        const out = (p.output ?? {}) as Record<string, unknown>;
        const input = (p.input ?? {}) as Record<string, unknown>;
        const candidate = (input.candidate ?? {}) as { result?: { job?: { title?: string; company?: string; url?: string } } };
        const job = candidate?.result?.job;
        const phaseRoot = phaseDir(p.id, "prep");
        const [applyMd, resumePdf, coverPdf] = await Promise.all([
          fileExists(path.join(phaseRoot, "apply.md")),
          fileExists(path.join(phaseRoot, "resume.pdf")),
          fileExists(path.join(phaseRoot, "cover.pdf")),
        ]);
        const applied = appliedByPrepId.get(p.id) ?? null;
        return {
          taskId: p.id,
          status: p.status,
          jobId: (out.jobId as number | undefined) ?? null,
          title: (out.title as string | undefined) ?? job?.title ?? "—",
          company: (out.company as string | undefined) ?? job?.company ?? "—",
          url: (out.url as string | undefined) ?? job?.url ?? null,
          applyMdExists: applyMd,
          resumePdfExists: resumePdf,
          coverPdfExists: coverPdf,
          appliedTaskId: applied?.id ?? null,
          appliedStatus: applied?.status ?? null,
          updatedAt: p.updatedAt,
        };
      }),
    );

    const prepCounts: Record<string, number> = {};
    for (const p of prep) prepCounts[p.status] = (prepCounts[p.status] ?? 0) + 1;
    const appliedCount = prep.filter((p) => p.appliedStatus === "completed").length;

    const discoverOut = (d.output ?? {}) as Record<string, unknown>;
    const selectOut = (select?.output ?? {}) as Record<string, unknown>;
    const discoverPhaseDir = phaseDir(d.id, "discover");
    const selectPhaseDir = select ? phaseDir(select.id, "select") : null;
    const [candidatesMd, reviewMd] = await Promise.all([
      fileExists(path.join(discoverPhaseDir, "candidates.md")),
      selectPhaseDir ? fileExists(path.join(selectPhaseDir, "review.md")) : Promise.resolve(false),
    ]);

    runs.push({
      discoverId: d.id,
      createdAt: d.createdAt,
      updatedAt: prep.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), select?.updatedAt ?? d.updatedAt),
      discoverStatus: d.status,
      selectId: select?.id ?? null,
      selectStatus: select?.status ?? null,
      candidateCount: (discoverOut.candidateCount as number | undefined) ?? null,
      selectedCount: (selectOut.selectedCount as number | undefined) ?? null,
      minMatchScore: (discoverOut.minMatchScore as number | undefined) ?? null,
      droppedBelowFloor: (discoverOut.droppedBelowFloor as number | undefined) ?? null,
      candidatesMdExists: candidatesMd,
      reviewMdExists: reviewMd,
      prep,
      prepCounts,
      appliedCount,
    });
  }

  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Surface select/needs_review and mark-applied/needs_review tasks for the
  // captain — those are where a human click is required.
  const awaitingApproval = tasks
    .filter((t) => t.status === "needs_review")
    .map((t) => ({
      taskId: t.id,
      phaseId: t.phaseId,
      updatedAt: t.updatedAt,
      hint: hintForApproval(t, byId),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const failures = extractFailures(tasks);

  const phases = rolenextJobApplyPipeline.phases.map((ph) => ({
    id: ph.id,
    gateType: ph.gateType,
  }));

  return {
    pipelineId: PIPELINE_ID,
    config: {
      jwtSet: !!process.env.ROLENEXT_JWT,
      apiBase: process.env.ROLENEXT_API_BASE ?? "http://localhost:8080",
      fanOutBatchSize: rolenextJobApplyPipeline.fanOutBatchSize ?? null,
      perTickCap: rolenextJobApplyPipeline.perTickCap ?? null,
    },
    phases,
    runs,
    awaitingApproval,
    failures,
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function hintForApproval(t: Task, byId: Map<string, Task>): string {
  if (t.phaseId === "select") {
    const out = (t.output ?? {}) as Record<string, unknown>;
    const n = out.selectedCount as number | undefined;
    return n ? `approve to fan out ${n} prep tasks` : "review queued candidates";
  }
  if (t.phaseId === "mark-applied") {
    const input = (t.input ?? {}) as Record<string, unknown>;
    const title = input.title as string | undefined;
    const company = input.company as string | undefined;
    return title && company
      ? `confirm submission of ${title} — ${company}`
      : "confirm submission";
  }
  void byId;
  return "needs review";
}
