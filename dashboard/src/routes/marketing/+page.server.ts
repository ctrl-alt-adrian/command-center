import { getKBEntries } from "../../../../pipelines/marketing/lib/kb.ts";
import { getDraftSets } from "../../../../pipelines/marketing/lib/drafts.ts";
import { getPlatformConfig } from "../../../../pipelines/marketing/lib/config.ts";
import { PLATFORMS } from "../../../../pipelines/marketing/lib/constants.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { getPipeline } from "../../../../core/lib/registry.ts";

export async function load() {
  const [kb, drafts, platforms, tasks] = await Promise.all([
    getKBEntries().catch(() => []),
    getDraftSets().catch(() => []),
    getPlatformConfig().catch(() => ({ enabled: [], disabled: [] })),
    listTasksByPipeline("marketing"),
  ]);

  const pipeline = getPipeline("marketing");
  const phases = pipeline?.phases.map((p) => ({ id: p.id, gateType: p.gateType })) ?? [];

  const recentTasks = tasks.slice(0, 10).map((t) => ({
    id: t.id,
    phaseId: t.phaseId,
    status: t.status,
    updatedAt: t.updatedAt,
  }));

  return {
    kbCount: kb.length,
    kbRecent: kb.slice(0, 10).map((e) => ({ id: e.id, summary: e.summary, date: e.date })),
    draftCount: drafts.length,
    draftRecent: drafts.slice(0, 10).map((d) => ({
      date: d.date,
      title: d.title,
      platforms: Object.keys(d.platforms),
    })),
    allPlatforms: [...PLATFORMS],
    enabledPlatforms: platforms.enabled as string[],
    disabledPlatforms: platforms.disabled as string[],
    taskCount: tasks.length,
    needsReview: tasks.filter((t) => t.status === "needs_review").length,
    failedCount: tasks.filter((t) => t.status === "failed").length,
    recentTasks,
    phases,
  };
}
