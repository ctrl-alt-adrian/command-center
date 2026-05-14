## Why

The docx's case B is the highest-leverage signal source for the SW-engineer / job-search niche: per-channel outlier ratios on tracked creators plus velocity-filtered niche-query results. "What is spiking against this creator's own baseline?" beats global view-count thresholds because it normalizes for channel size, surfacing genuinely-new signals instead of resurrecting big channels every day. One scraper feeds two consumers — a `/competitors` page for the captain to browse, and the marketing pipeline's External Signals subagent reading the same JSON during discovery — with zero duplicated work. The output itself is build-in-public content: "here's what's spiking in the SWE-career niche this week" is itself a post.

## What Changes

- Add `pipelines/competitors/` with a daily 10 AM scraper phase that hits 15 tracked YouTube channels and 22 niche queries (configurable lists).
- Implement two filters: per-channel outlier ratio (`views / channel_30d_median ≥ 2.0`) and velocity for niche-query results (`viewsPerDay ≥ 5000` OR `totalViews ≥ 100_000`).
- Persist results to `signals/competitors/<date>.json` with tabs structure (`top`, `outliers`, `niche`, `shorts`, `archive`) plus per-channel rolling median state.
- Add `/competitors` dashboard route: six tabs (Top, Outliers, Niche, Channels, Shorts, Archive), browse with thumbnails, click through to YouTube.
- Hook the External Signals subagent in marketing-pipeline discovery to read `signals/competitors/<latest>.json` directly.
- Wire a one-task-per-day cron at 10 AM that runs the full scrape + filter and lands a `paused_backpressure`-respecting summary task on the queue.

## Capabilities

### New Capabilities
- `competitor-signals`: YouTube scraper with per-channel rolling baselines and outlier + velocity filtering
- `competitors-surface`: `/competitors` dashboard with six-tab browse view consumed by both human and agent

### Modified Capabilities
<!-- none new; the marketing-pipeline discovery already declares it reads `signals/`; the format is additive -->

## Impact

- New dependency: a YouTube data source. Options: yt-dlp metadata only, the YouTube Data API v3, or a hosted scraper (Apify Scweet equivalent). Preferred: YouTube Data API v3 with a free-tier key.
- New env var: `YOUTUBE_API_KEY` (optional; scraper falls back to yt-dlp if unset).
- New env var: `COMPETITOR_CHANNELS` and `COMPETITOR_QUERIES` (path to YAML lists; defaults committed to repo).
- One new cron entry: daily 10 AM scrape.
- No changes to marketing-pipeline's discovery phase code shape; only the file it reads grows.
