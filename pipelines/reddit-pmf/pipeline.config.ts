import fs from "fs/promises";
import path from "path";
import type { PipelineConfig } from "../../core/lib/types.ts";
import { loadConfig, runScrape } from "./lib/scrape.ts";
import { runExtract } from "./lib/extract.ts";
import { runDeploy } from "./lib/deploy.ts";
import { loadHypotheses } from "./lib/hypotheses.ts";
import { SIGNALS_DIR } from "../../core/lib/paths.ts";

const REDDIT_PMF_DIR = path.join(SIGNALS_DIR, "reddit-pmf");

export const redditPmfPipeline: PipelineConfig = {
  id: "reddit-pmf",
  description:
    "Weekly zero-gate Reddit PMF pipeline. Scrapes top-of-week posts from 5 SWE-career subreddits, " +
    "clusters complaint patterns into 3-7 landing-page hypotheses via Claude Sonnet (with intra-phase " +
    "slop retry), and deploys each cluster as a landing page. Dry-run by default — set VERCEL_TOKEN " +
    "to push to a real Vercel project. Market signal (CTR + signups) replaces human gates.",
  backpressureCap: 5,
  cronSchedule: "0 8 * * 1",
  phases: [
    {
      id: "scrape",
      gateType: "auto_pass",
      timeoutMs: 5 * 60 * 1000,
      run: async (_task, ctx) => {
        const cfg = await loadConfig();
        const result = await runScrape(cfg, (msg, data) => ctx.log(msg, data));
        await fs.mkdir(ctx.outputDir, { recursive: true });
        await fs.writeFile(path.join(ctx.outputDir, "posts.json"), JSON.stringify(result.posts, null, 2), "utf-8");
        await fs.writeFile(path.join(ctx.outputDir, "failures.json"), JSON.stringify(result.failures, null, 2), "utf-8");
        return {
          output: {
            posts_path: path.join(ctx.outputDir, "posts.json"),
            post_count: result.posts.length,
            failed_subs: result.failures.length,
          },
        };
      },
    },
    {
      id: "extract",
      gateType: "auto_pass",
      timeoutMs: 15 * 60 * 1000,
      run: async (task, ctx) => {
        const cfg = await loadConfig();
        const postsPath = task.input.posts_path as string | undefined;
        if (!postsPath) throw new Error("extract requires posts_path from upstream scrape");
        const posts = JSON.parse(await fs.readFile(postsPath, "utf-8"));
        const result = await runExtract(posts, cfg, (msg, data) => ctx.log(msg, data));
        await fs.writeFile(path.join(ctx.outputDir, "clusters.json"), JSON.stringify(result.clusters, null, 2), "utf-8");
        return {
          output: {
            clusters_path: path.join(ctx.outputDir, "clusters.json"),
            cluster_count: result.clusters.length,
            attempts: result.attempts,
          },
        };
      },
    },
    {
      id: "deploy",
      gateType: "auto_pass",
      timeoutMs: 15 * 60 * 1000,
      run: async (task, ctx) => {
        const cfg = await loadConfig();
        const clustersPath = task.input.clusters_path as string | undefined;
        if (!clustersPath) throw new Error("deploy requires clusters_path from upstream extract");
        const clusters = JSON.parse(await fs.readFile(clustersPath, "utf-8"));
        const result = await runDeploy(clusters, cfg, (msg, data) => ctx.log(msg, data));
        await fs.writeFile(path.join(ctx.outputDir, "deploy.json"), JSON.stringify(result, null, 2), "utf-8");
        return {
          output: {
            mode: result.mode,
            deployed: result.deployed.length,
            failed: result.failed.length,
            outputDir: result.outputDir,
          },
        };
      },
    },
  ],
};

export const redditPmfMetricsPipeline: PipelineConfig = {
  id: "reddit-pmf-metrics",
  description:
    "Weekly metrics sweep for live reddit-pmf hypotheses. Reads hypotheses.json, fetches CTR + signup " +
    "metrics per deployed URL, writes signals/reddit-pmf/metrics-<date>.json. Stub until VERCEL_TOKEN " +
    "is set and at least one deploy has gone live.",
  backpressureCap: 5,
  cronSchedule: "0 17 * * 5",
  phases: [
    {
      id: "sweep",
      gateType: "auto_pass",
      timeoutMs: 5 * 60 * 1000,
      run: async (_task, ctx) => {
        await fs.mkdir(REDDIT_PMF_DIR, { recursive: true });
        const hypotheses = await loadHypotheses();
        const live = hypotheses.filter((h) => h.status === "live");
        const today = new Date().toISOString().slice(0, 10);
        const out = {
          date: today,
          live_count: live.length,
          metrics: live.map((h) => ({ id: h.id, deployUrl: h.deployUrl, weekOf: h.weekOf, ctr: null, signups: null })),
          note: "stub: real CTR + signup pull lands when Vercel Analytics integration is wired",
        };
        await fs.writeFile(path.join(REDDIT_PMF_DIR, `metrics-${today}.json`), JSON.stringify(out, null, 2), "utf-8");
        await fs.writeFile(path.join(REDDIT_PMF_DIR, "metrics-latest.json"), JSON.stringify(out, null, 2), "utf-8");
        ctx.log("metrics sweep wrote stub", { live: live.length });
        return { output: { live: live.length, date: today } };
      },
    },
  ],
};
