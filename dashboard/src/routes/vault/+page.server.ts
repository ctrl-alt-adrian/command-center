import { listNotes, listOrphanLinks, PILLARS } from "../../../../core/lib/vault.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { listStagedCandidates } from "../../../../pipelines/vault-nuggets/lib/extract.ts";
import { VAULT_ROOT } from "../../../../core/lib/paths.ts";

export async function load() {
  const [notes, orphans, tasks] = await Promise.all([
    listNotes().catch(() => []),
    listOrphanLinks().catch(() => []),
    listTasksByPipeline("vault-nuggets"),
  ]);

  const runningExtract = tasks.find((t) => t.status === "running" && t.phaseId === "extract");

  // Per-pillar counts
  const counts: Record<string, number> = {};
  const recentByPillar: Record<string, Array<{ filename: string; pillar: string; title: string; created: string }>> = {};
  for (const p of PILLARS) {
    counts[p] = 0;
    recentByPillar[p] = [];
  }
  for (const n of notes) {
    if (n.filename.toLowerCase() === "map of content") continue;
    counts[n.pillar] = (counts[n.pillar] ?? 0) + 1;
    recentByPillar[n.pillar] = recentByPillar[n.pillar] ?? [];
    recentByPillar[n.pillar].push({
      filename: n.filename,
      pillar: n.pillar,
      title: (n.frontmatter.title as string) || n.filename,
      created: (n.frontmatter.created as string) || "",
    });
  }
  for (const p of Object.keys(recentByPillar)) {
    recentByPillar[p].sort((a, b) => (b.created > a.created ? 1 : -1));
    recentByPillar[p] = recentByPillar[p].slice(0, 3);
  }

  // Pending review tasks → load staged counts
  const pendingTasks = tasks.filter((t) => t.status === "needs_review");
  const pendingDetails = await Promise.all(
    pendingTasks.map(async (t) => {
      const staged = await listStagedCandidates(t.id);
      return {
        id: t.id,
        updatedAt: t.updatedAt,
        candidateCount: staged.length,
        approved: staged.filter((s) => s.status === "approved").length,
        rejected: staged.filter((s) => s.status === "rejected").length,
      };
    }),
  );

  const totalNotes = notes.filter((n) => n.filename.toLowerCase() !== "map of content").length;
  return {
    pillars: PILLARS.map((p) => ({
      slug: p,
      count: counts[p],
      recent: recentByPillar[p],
    })),
    totalNotes,
    orphanCount: orphans.length,
    pendingReview: pendingDetails,
    taskCount: tasks.length,
    failedCount: tasks.filter((t) => t.status === "failed" || t.status === "cleared_stale").length,
    runningExtract: runningExtract
      ? { id: runningExtract.id, startedAt: runningExtract.createdAt }
      : null,
    vaultRoot: VAULT_ROOT,
  };
}
