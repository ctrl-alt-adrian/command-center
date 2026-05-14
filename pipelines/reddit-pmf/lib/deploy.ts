import fs from "fs/promises";
import path from "path";
import { SIGNALS_DIR } from "../../../core/lib/paths.ts";
import type { Cluster, Hypothesis, RedditPmfConfig } from "./types.ts";
import { appendHypotheses } from "./hypotheses.ts";

const REDDIT_PMF_DIR = path.join(SIGNALS_DIR, "reddit-pmf");
const TEMPLATE_DIR = path.resolve(import.meta.dirname, "..", "landing-template");

export interface DeployResult {
  mode: "dry_run" | "vercel";
  deployed: Hypothesis[];
  failed: Array<{ clusterId: string; reason: string }>;
  outputDir: string;
}

function mondayOf(now = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // 0 = Sunday → previous Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function buildContent(cluster: Cluster, weekOf: string): Record<string, unknown> {
  return {
    cluster_id: cluster.id,
    headline: cluster.headline,
    subhead: cluster.subhead,
    cta: cluster.cta,
    attribution: `Built for r/${cluster.source_post_ids.length > 0 ? "your-subreddit" : "anonymous"} signal. ${weekOf}`,
    positioning: cluster.positioning,
  };
}

async function writeClusterFiles(clusterDir: string, content: Record<string, unknown>): Promise<void> {
  await fs.mkdir(clusterDir, { recursive: true });
  // Copy template files
  for (const f of ["index.html", "landing.css", "landing.js", "README.md"]) {
    const src = path.join(TEMPLATE_DIR, f);
    const dst = path.join(clusterDir, f);
    await fs.copyFile(src, dst).catch(() => undefined);
  }
  await fs.writeFile(path.join(clusterDir, "content.json"), JSON.stringify(content, null, 2), "utf-8");
}

function deployModeFromEnv(cfg: RedditPmfConfig): DeployResult["mode"] {
  if (cfg.deploy.force_dry_run) return "dry_run";
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.LANDING_REPO_PATH) {
    return "vercel";
  }
  return "dry_run";
}

export async function runDeploy(
  clusters: Cluster[],
  cfg: RedditPmfConfig,
  log: (msg: string, data?: unknown) => void,
): Promise<DeployResult> {
  const mode = deployModeFromEnv(cfg);
  const weekOf = mondayOf();
  const outDir = path.join(REDDIT_PMF_DIR, weekOf);
  await fs.mkdir(outDir, { recursive: true });

  log("deploy starting", { mode, weekOf, count: clusters.length });

  const deployed: Hypothesis[] = [];
  const failed: DeployResult["failed"] = [];

  for (const cluster of clusters) {
    const clusterDir = path.join(outDir, cluster.id);
    const content = buildContent(cluster, weekOf);
    await writeClusterFiles(clusterDir, content);

    if (mode === "dry_run") {
      deployed.push({
        id: cluster.id,
        cluster,
        status: "dry_run",
        weekOf,
        notes: `dry-run: files at ${clusterDir}`,
      });
      continue;
    }

    // Vercel deploy not implemented in this commit. See landing-template/README.md
    // for the manual steps. The plumbing here keeps the structure ready so adding
    // real Vercel push is a localized change.
    failed.push({ clusterId: cluster.id, reason: "vercel mode wiring is documented but not implemented in this build" });
    deployed.push({
      id: cluster.id,
      cluster,
      status: "failed_deploy",
      weekOf,
      notes: "vercel push not wired",
    });
  }

  await appendHypotheses(deployed);
  log("deploy complete", { deployed: deployed.length, failed: failed.length, outDir });

  return { mode, deployed, failed, outputDir: outDir };
}
