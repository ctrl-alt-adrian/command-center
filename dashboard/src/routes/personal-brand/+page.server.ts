import { discoverBrandCandidates } from "../../../../pipelines/personal-brand/lib/discovery.ts";
import { getBrandDraftSets } from "../../../../pipelines/personal-brand/lib/drafts.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { countTasksByStatus } from "$lib/failures";

export async function load() {
  const [eligible, drafts, tasks] = await Promise.all([
    discoverBrandCandidates().catch(() => []),
    getBrandDraftSets().catch(() => []),
    listTasksByPipeline("personal-brand"),
  ]);

  // Most-recent first
  const recentTasks = [...tasks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      phaseId: t.phaseId,
      status: t.status,
      updatedAt: t.updatedAt,
      output: t.output,
    }));

  const c = countTasksByStatus(tasks);
  return {
    eligibleCount: eligible.length,
    eligiblePreview: eligible.slice(0, 8).map((c) => ({
      id: c.id,
      pillar: c.pillar,
      filename: c.filename,
      title: c.title,
      reason: c.reason,
    })),
    draftCount: drafts.length,
    taskCount: tasks.length,
    needsReview: c.needs_review,
    runningCount: c.running,
    failedCount: c.failed + c.cleared_stale,
    recentTasks,
  };
}
