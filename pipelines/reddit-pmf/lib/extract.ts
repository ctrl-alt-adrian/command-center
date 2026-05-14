import fs from "fs/promises";
import path from "path";
import { claude } from "../../../core/lib/claude.ts";
import { runRules } from "../../../core/lib/slop.ts";
import { REDDIT_SLOP_PACK, loadRedditSlopPack } from "./slop-loader.ts";
import type { Cluster, RedditPost, RedditPmfConfig } from "./types.ts";

const CLI_DIR = path.resolve(import.meta.dirname, "..", "cli");

function buildCorpus(posts: RedditPost[]): string {
  // Token-bound the corpus — keep ~120 posts max with a title + truncated body.
  const trimmed = posts.slice(0, 120);
  return trimmed
    .map((p) => {
      const body = p.selftext.length > 700 ? p.selftext.slice(0, 700) + "…" : p.selftext;
      return `--- id:${p.id} r/${p.subreddit} score:${p.score} comments:${p.num_comments} ---
TITLE: ${p.title}
${body}`;
    })
    .join("\n\n");
}

function parseClusters(raw: string): Cluster[] | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  if (!trimmed) return null;
  try {
    const arr = JSON.parse(trimmed) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((c) =>
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.headline === "string" &&
        typeof c.subhead === "string" &&
        typeof c.cta === "string",
      )
      .map((c) => ({
        id: String(c.id),
        name: String(c.name),
        representative_quote: typeof c.representative_quote === "string" ? c.representative_quote : "",
        underlying_pain: typeof c.underlying_pain === "string" ? c.underlying_pain : "",
        positioning: typeof c.positioning === "string" ? c.positioning : "",
        headline: String(c.headline),
        subhead: String(c.subhead),
        cta: String(c.cta),
        source_post_ids: Array.isArray(c.source_post_ids) ? (c.source_post_ids as string[]).map(String) : [],
      }));
  } catch {
    return null;
  }
}

function checkClustersForSlop(clusters: Cluster[]): string {
  // Concatenate every user-visible string and run slop. Return a feedback string
  // listing violations, or "" if clean.
  const text = clusters
    .map((c) => [c.name, c.representative_quote, c.underlying_pain, c.positioning, c.headline, c.subhead, c.cta].join("\n"))
    .join("\n\n");
  const result = runRules(text, REDDIT_SLOP_PACK);
  if (result.pass) return "";
  return result.violations
    .filter((v) => v.severity === "fail")
    .slice(0, 20)
    .map((v) => `- [${v.ruleId}] "${v.excerpt}"`)
    .join("\n");
}

export interface ExtractResult {
  clusters: Cluster[];
  attempts: number;
  posts_scanned: number;
}

export async function runExtract(
  posts: RedditPost[],
  cfg: RedditPmfConfig,
  log: (msg: string, data?: unknown) => void,
): Promise<ExtractResult> {
  await loadRedditSlopPack();
  const corpus = buildCorpus(posts);
  const promptHead = await fs.readFile(path.join(CLI_DIR, "extract.md"), "utf-8");

  let lastFeedback = "";
  for (let attempt = 1; attempt <= cfg.extract.slop_max_retries; attempt++) {
    const fullPrompt = `${promptHead}

---

POSTS CORPUS:

${corpus}

${
      lastFeedback
        ? `\nPRIOR ATTEMPT FAILED THE SLOP GATE — fix every violation below:\n${lastFeedback}\n`
        : ""
    }

Return strict JSON array now. ${cfg.extract.min_clusters}-${cfg.extract.max_clusters} clusters, target ${cfg.extract.target_clusters}.`;

    log(`extract attempt ${attempt}`);
    const raw = await claude(fullPrompt, { model: cfg.extract.model, timeoutMs: 5 * 60 * 1000 });
    const clusters = parseClusters(raw);
    if (!clusters) {
      lastFeedback = "Output was not parseable JSON. Return ONLY a JSON array, no fences, no prose.";
      continue;
    }
    if (clusters.length < cfg.extract.min_clusters) {
      log(`only ${clusters.length} clusters returned; need ${cfg.extract.min_clusters}`);
      return { clusters, attempts: attempt, posts_scanned: posts.length };
    }

    const slopFeedback = checkClustersForSlop(clusters);
    if (slopFeedback) {
      lastFeedback = slopFeedback;
      log(`slop violations on attempt ${attempt}`, { count: slopFeedback.split("\n").length });
      continue;
    }

    const trimmed = clusters.slice(0, cfg.extract.max_clusters);
    log(`extract clean on attempt ${attempt}`, { clusters: trimmed.length });
    return { clusters: trimmed, attempts: attempt, posts_scanned: posts.length };
  }

  throw new Error(`Reddit extract failed slop gate after ${cfg.extract.slop_max_retries} attempts`);
}
