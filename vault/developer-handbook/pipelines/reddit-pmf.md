# Pipelines: `reddit-pmf` + `reddit-pmf-metrics`

**Config:** `pipelines/reddit-pmf/pipeline.config.ts` exports **two** configs — `redditPmfPipeline` (line 12) and `redditPmfMetricsPipeline` (line 85).

## Purpose (domain)

Weekly **zero-gate** product-market-fit probe. Scrapes top-of-week posts from 5 SWE-career subreddits, clusters the complaint patterns into 3–7 landing-page hypotheses via Claude Sonnet (with an intra-phase slop retry loop), and "deploys" each cluster as a landing page. The premise: **market signal (CTR + signups) replaces the human gate** — every gate is `auto_pass` by design. A second pipeline (`reddit-pmf-metrics`) is meant to sweep live hypotheses for those metrics.

## `reddit-pmf` — phase-by-phase

| phase | gateType | what `run()` does | files read / written |
|---|---|---|---|
| `scrape` | auto_pass | `fetchTopPosts` per subreddit via Reddit's **public JSON** (`/r/<sub>/top.json?t=week`, UA-only, no OAuth). Optional flair filter per sub. | reads `config.yaml`, `subreddits.yaml`; writes `outputDir/posts.json`, `failures.json`. |
| `extract` | auto_pass | `runExtract(posts, cfg, log)` — build a token-bounded corpus (≤120 posts), Claude **Sonnet** clusters into 3–7 clusters. **In-phase slop retry loop** up to `slop_max_retries` using pack `reddit-voice`; re-prompts with the violations on each retry. | reads upstream `posts.json` + `cli/extract.md`; writes `outputDir/clusters.json`. |
| `deploy` | auto_pass | `runDeploy(clusters, cfg, log)` — for each cluster, copy `landing-template/` (`index.html`, `landing.css`, `landing.js`, `README.md`) + write `content.json` into `signals/reddit-pmf/<weekOf>/<clusterId>/`. Mode = `dry_run` unless env wired. Appends to `hypotheses.json`. | writes per-cluster landing files + `outputDir/deploy.json`; updates `signals/reddit-pmf/hypotheses.json`. |

## `reddit-pmf-metrics` — single sweep phase

| phase | gateType | what `run()` does | files read / written |
|---|---|---|---|
| `sweep` | auto_pass | Reads `hypotheses.json`, filters `status === "live"`, emits **stub** metrics (`ctr:null`, `signups:null`). | writes `signals/reddit-pmf/metrics-<date>.json` + `metrics-latest.json`. |

### Data flow

- **Input source:** cron POST `/api/tasks`. Active in `cron/cron.txt`: `reddit-pmf` at `0 8 * * 1` (Mon 8 AM), `reddit-pmf-metrics` at `0 17 * * 5` (Fri 5 PM).
- **Phase chaining is by file path in `task.input`:** scrape emits `posts_path`; extract reads it and emits `clusters_path`; deploy reads that. (`pipeline.config.ts:33-79`.)
- **External calls:** `fetch()` to `www.reddit.com` (no shell, UA from `REDDIT_USER_AGENT` env or default `command-center-reddit-pmf/0.1`, 30s abort timeout); Claude Sonnet via `core/lib/claude.ts`.

## Config knobs

- `reddit-pmf`: `backpressureCap: 5`, no `perTickCap` (global pool), `cronSchedule: "0 8 * * 1"`. Phase timeouts: scrape 5m, extract 15m, deploy 15m.
- `reddit-pmf-metrics`: `backpressureCap: 5`, `cronSchedule: "0 17 * * 5"`, sweep timeout 5m.
- `config.yaml`:
  - `scrape.posts_per_subreddit: 50`, `scrape.timeframe: week`
  - `extract.min_clusters: 3`, `max_clusters: 7`, `target_clusters: 5`, `slop_max_retries: 3`, `model: "claude-sonnet-4-6"`
  - `deploy.force_dry_run: false`
- `subreddits.yaml`: `cscareerquestions`, `EngineeringResumes`, `recruitinghell`, `csMajors`, `jobs` (two more commented out).

## Slop rules

Pack id **`reddit-voice`** (`slop-rules/reddit-voice.yaml`), loaded by `lib/slop-loader.ts`. **Far stricter than the marketing pack — almost every rule is `severity: fail`.** Covers AI tells (`delve`, `tapestry`, `leverage`, `seamless`, `robust`, `unlock`), LinkedIn-ese (`synergy`, `paradigm shift`, `deep dive`), AI openers ("here's the thing", "let me explain", "let's dive in"), engagement bait ("what do you think?", "agree or disagree?", "drop a … in the comments"), and the em-dash. Unlike marketing, the gate is **inside `extract`**, not a separate deterministic phase:

```ts
// pipelines/reddit-pmf/lib/extract.ts:84-122 (abridged)
for (let attempt = 1; attempt <= cfg.extract.slop_max_retries; attempt++) {
  const fullPrompt = `${promptHead}\n\n---\n\nPOSTS CORPUS:\n\n${corpus}\n${
    lastFeedback ? `\nPRIOR ATTEMPT FAILED THE SLOP GATE — fix every violation below:\n${lastFeedback}\n` : ""
  }\nReturn strict JSON array now. ${cfg.extract.min_clusters}-${cfg.extract.max_clusters} clusters, target ${cfg.extract.target_clusters}.`;
  const raw = await claude(fullPrompt, { model: cfg.extract.model, timeoutMs: 5 * 60 * 1000 });
  const clusters = parseClusters(raw);
  if (!clusters) { lastFeedback = "Output was not parseable JSON ..."; continue; }
  if (clusters.length < cfg.extract.min_clusters) return { clusters, attempts: attempt, posts_scanned: posts.length };
  const slopFeedback = checkClustersForSlop(clusters); // runRules(text, REDDIT_SLOP_PACK)
  if (slopFeedback) { lastFeedback = slopFeedback; continue; }
  return { clusters: clusters.slice(0, cfg.extract.max_clusters), attempts: attempt, posts_scanned: posts.length };
}
throw new Error(`Reddit extract failed slop gate after ${cfg.extract.slop_max_retries} attempts`);
```

If all retries fail the slop gate, `extract` **throws** — the processor surfaces the error on the task (no rewind, since the loop is internal).

## Key helper functions (`lib/`)

- `reddit.ts` — `fetchTopPosts(subreddit, limit, timeframe): Promise<RedditPost[]>` (public JSON, drops stickied posts).
- `scrape.ts` — `runScrape(cfg, log)`, `loadConfig()`, `loadSubreddits()`.
- `extract.ts` — `runExtract(posts, cfg, log): Promise<ExtractResult>`; internal `buildCorpus`, `parseClusters`, `checkClustersForSlop`.
- `deploy.ts` — `runDeploy(clusters, cfg, log): Promise<DeployResult>`; `deployModeFromEnv`, `writeClusterFiles`, `mondayOf`.
- `hypotheses.ts` — `loadHypotheses()`, `appendHypotheses(items)` (upsert by `id`+`weekOf`), `updateStatus(id, weekOf, status, notes?)`.

## Working-vs-stub verdict

**Working through dry-run; the actual Vercel deploy is NOT implemented.** Scrape + extract + dry-run deploy all do real work (real Reddit fetch, real Sonnet clustering, real landing-template materialization). But:

- **Vercel push is a documented no-op.** `deployModeFromEnv` returns `"vercel"` only when `VERCEL_TOKEN` **and** `VERCEL_PROJECT_ID` **and** `LANDING_REPO_PATH` are all set (and `force_dry_run` is false) — but even in that branch nothing is pushed:

```ts
// pipelines/reddit-pmf/lib/deploy.ts:86-96
// Vercel deploy not implemented in this commit. See landing-template/README.md
// for the manual steps. The plumbing here keeps the structure ready ...
failed.push({ clusterId: cluster.id, reason: "vercel mode wiring is documented but not implemented in this build" });
deployed.push({ id: cluster.id, cluster, status: "failed_deploy", weekOf, notes: "vercel push not wired" });
```

So in vercel mode every cluster lands as `status: "failed_deploy"`. Practically the pipeline only ever produces `dry_run` hypotheses.

- **`reddit-pmf-metrics` is a pure stub.** It writes `ctr: null, signups: null` with `note: "stub: real CTR + signup pull lands when Vercel Analytics integration is wired"` (`pipeline.config.ts:103-108`). The pipeline config description itself says "Stub until VERCEL_TOKEN is set and at least one deploy has gone live."

Net: the discovery half (scrape → cluster → stage landing files) is real and useful; the publish + measure loop is scaffolded but inert.

## Cross-links

- Slop engine (`runRules`, `registerSlopPack`): [../core/08-slop-engine.md](../core/08-slop-engine.md)
- Gates (note: all `auto_pass` here, gate logic lives in-phase): [../core/04-gates.md](../core/04-gates.md)
- Claude wrapper: [../core/06-claude-wrapper.md](../core/06-claude-wrapper.md)
