import { discoverBrandCandidates } from "../../../../pipelines/personal-brand/lib/discovery.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";

export async function load() {
  const [eligible, tasks] = await Promise.all([
    discoverBrandCandidates().catch(() => []),
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

  return {
    eligibleCount: eligible.length,
    eligiblePreview: eligible.slice(0, 8).map((c) => ({
      id: c.id,
      pillar: c.pillar,
      title: c.title,
      reason: c.reason,
    })),
    taskCount: tasks.length,
    needsReview: tasks.filter((t) => t.status === "needs_review").length,
    runningCount: tasks.filter((t) => t.status === "running").length,
    failedCount: tasks.filter((t) => t.status === "failed" || t.status === "cleared_stale").length,
    recentTasks,
  };
}
