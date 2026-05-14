import fs from "fs/promises";
import path from "path";
import { SIGNALS_DIR } from "../../../../core/lib/paths.ts";
import { loadHypotheses } from "../../../../pipelines/reddit-pmf/lib/hypotheses.ts";
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";

interface MetricsLatest {
  date?: string;
  metrics?: Array<{ id: string; ctr: number | null; signups: number | null; weekOf?: string }>;
}

export async function load() {
  const [hypotheses, tasks] = await Promise.all([
    loadHypotheses(),
    listTasksByPipeline("reddit-pmf"),
  ]);

  // Latest metrics (stub format)
  let metricsLatest: MetricsLatest | null = null;
  try {
    metricsLatest = JSON.parse(await fs.readFile(path.join(SIGNALS_DIR, "reddit-pmf", "metrics-latest.json"), "utf-8"));
  } catch {
    metricsLatest = null;
  }

  // "Links awaiting placement" — live hypotheses deployed in past 7 days with zero clicks
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const awaitingPlacement = hypotheses.filter((h) => {
    if (h.status !== "live") return false;
    if (!h.deployedAt) return false;
    const t = Date.parse(h.deployedAt);
    if (!Number.isFinite(t) || t < sevenDaysAgo) return false;
    const m = metricsLatest?.metrics?.find((x) => x.id === h.id);
    return !m || (m.ctr ?? 0) === 0;
  });

  // Build the displayable row set
  const recent = [...hypotheses]
    .sort((a, b) => (b.weekOf > a.weekOf ? 1 : -1))
    .slice(0, 50)
    .map((h) => {
      const m = metricsLatest?.metrics?.find((x) => x.id === h.id);
      return {
        id: h.id,
        name: h.cluster.name,
        weekOf: h.weekOf,
        status: h.status,
        deployUrl: h.deployUrl,
        deployedAt: h.deployedAt,
        ctr: m?.ctr ?? null,
        signups: m?.signups ?? null,
        notes: h.notes,
      };
    });

  return {
    hypotheses: recent,
    counts: {
      total: hypotheses.length,
      live: hypotheses.filter((h) => h.status === "live").length,
      dryRun: hypotheses.filter((h) => h.status === "dry_run").length,
      winners: hypotheses.filter((h) => h.status === "winner").length,
      failed: hypotheses.filter((h) => h.status === "failed_deploy").length,
      archived: hypotheses.filter((h) => h.status === "archived").length,
    },
    awaitingPlacement: awaitingPlacement.map((h) => ({ id: h.id, name: h.cluster.name, deployUrl: h.deployUrl })),
    runningTasks: tasks.filter((t) => t.status === "running" || t.status === "pending").length,
    lastTaskAt: tasks[0]?.updatedAt ?? null,
    deployMode: process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.LANDING_REPO_PATH ? "vercel" : "dry_run",
  };
}
