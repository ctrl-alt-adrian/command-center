import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { fetchTopPosts } from "./reddit.ts";
import type { RedditPmfConfig, RedditPost, SubredditConfig } from "./types.ts";

const PIPELINE_DIR = path.resolve(import.meta.dirname, "..");
const CONFIG_YAML = path.join(PIPELINE_DIR, "config.yaml");
const SUBREDDITS_YAML = path.join(PIPELINE_DIR, "subreddits.yaml");

export async function loadConfig(): Promise<RedditPmfConfig> {
  const raw = await fs.readFile(CONFIG_YAML, "utf-8");
  return yaml.load(raw) as RedditPmfConfig;
}

export async function loadSubreddits(): Promise<SubredditConfig[]> {
  const raw = await fs.readFile(SUBREDDITS_YAML, "utf-8");
  const parsed = yaml.load(raw) as { subreddits?: SubredditConfig[] };
  return parsed.subreddits ?? [];
}

export interface ScrapeResult {
  posts: RedditPost[];
  failures: Array<{ subreddit: string; reason: string }>;
}

export async function runScrape(cfg: RedditPmfConfig, log: (msg: string, data?: unknown) => void): Promise<ScrapeResult> {
  const subs = await loadSubreddits();
  const posts: RedditPost[] = [];
  const failures: ScrapeResult["failures"] = [];

  for (const sub of subs) {
    try {
      log(`fetching r/${sub.name}`);
      const got = await fetchTopPosts(sub.name, cfg.scrape.posts_per_subreddit, cfg.scrape.timeframe);
      const filtered = sub.flair ? got.filter((p) => p.flair === sub.flair) : got;
      posts.push(...filtered);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push({ subreddit: sub.name, reason });
      log(`r/${sub.name} failed`, { reason });
    }
  }

  log("scrape complete", { total: posts.length, subs: subs.length, failed: failures.length });
  return { posts, failures };
}
