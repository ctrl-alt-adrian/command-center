# Pipeline: `competitors`

**Config:** `pipelines/competitors/pipeline.config.ts:4`

## Purpose (domain)

Daily YouTube competitor-outlier feed. Pulls recent uploads from tracked channels, maintains a rolling 30-day per-channel view-count median, and flags any video ≥ 2.0× its channel median as an outlier. Separately runs niche-query YouTube searches with a velocity filter. Writes a six-tab snapshot to `signals/competitors/<date>.json` (+ `latest.json`) consumed by both the `/competitors` dashboard and marketing discovery's external-signals subagent. **No Claude** — pure `yt-dlp` + math.

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut | files read / written |
|---|---|---|---|---|
| `scrape` | auto_pass | `runScrape()` — for each channel: `yt-dlp` uploads → `upsertChannelHistory` → `median` → outlier if `viewCount/median ≥ 2.0` (needs ≥ 3 distinct days of history). For each query: `yt-dlp ytsearchN:` → velocity filter. Builds + writes snapshot. | none. | reads `channels.yaml`, `queries.yaml`, `config.yaml`, `signals/competitors/state/<channelId>.json`; writes `signals/competitors/<date>.json`, `latest.json`, and per-channel `state/<channelId>.json`. |

Single-phase, single-task per run.

### Data flow

- **Input source:** cron POST `/api/tasks` `{"pipelineId":"competitors"}` — active in `cron/cron.txt` at `0 10 * * *`.
- **External tool shelled out:** `yt-dlp` via `execFile` (`lib/yt-dlp.ts`). Two call shapes:
  - `channelUploads(handle, limit, shortsMax)` → `https://www.youtube.com/<@handle>/videos --playlist-end <N> --flat-playlist --dump-json`.
  - `searchResults(query, limit, shortsMax)` → `ytsearch<N>:<query> --dump-json --no-download` (drops `--flat-playlist` so search results carry full metadata). Both wrapped in `.catch(() => [])` so a single channel/query failure is a warning, not a crash.
  - 90s timeout, 50 MB max buffer per call.
- **Outputs on disk:** snapshot JSON + `latest.json` under `signals/competitors/`; rolling state under `signals/competitors/state/`. The `archive` pointer in the snapshot links yesterday's file if present.

### Snapshot shape (six tabs)

`top` (channel outliers + niche merged, ranked, capped 50), `outliers`, `niche`, `channels` (all decorated uploads), `shorts` (`isShort` filter), `archive` (pointer), `warnings`.

## Config knobs

- Config: `backpressureCap: 5`, `perTickCap: 5` (slow yt-dlp, no Claude spend), `cronSchedule: "0 10 * * *"` (`pipeline.config.ts:13-15`). Phase timeout `30m`.
- `config.yaml` (reloaded each scrape):
  - `outlier.ratio: 2.0`, `outlier.min_history_days: 3`, `outlier.rolling_window_days: 30`
  - `velocity.views_per_day: 5000` **OR** `velocity.total_views: 100000` (either passes)
  - `scrape.uploads_per_channel: 20`, `scrape.results_per_query: 20`
  - `shorts.max_duration_seconds: 60`
- `channels.yaml` — 15 tracked handles (Fireship, ThePrimeagen, Joma, etc.); keyed by `channelId` so renames don't break state.
- `queries.yaml` — ~23 niche search queries (ATS/resume, interview prep, job-search reality, AI-for-job-seekers).

## Slop rules

**None** (no Claude output to check).

## Key helper functions (`lib/`)

- `scrape.ts` — `runScrape(): Promise<ScrapeResult>`, `loadConfig()`, `loadChannels()`, `loadQueries()`, plus dashboard readers `loadLatest()`, `listArchive()`, `loadByDate(date)`.
- `yt-dlp.ts` — `channelUploads(handle, limit, shortsMax)`, `searchResults(query, limit, shortsMax)`; internal `toVideoRecord`, `classifyShort` (duration ≤ max OR `#shorts` in title).
- `state.ts` — `upsertChannelHistory(channelId, newRecords, opts)` (append, key by `videoId`, trim to rolling window, atomic write), `median(numbers)`, `distinctDayCount(state)`, `readChannelState`/`writeChannelState`.

### Outlier detection core

```ts
// pipelines/competitors/lib/scrape.ts:99-111
const state = await upsertChannelHistory(channelId, records, {
  rollingWindowDays: cfg.outlier.rolling_window_days, channelTitle, handle: ch.handle,
});
const decorated = videos.map((v) => decorate({ ...v, channelHandle: ch.handle, channelId }, now));
channelVideos.push(...decorated);
if (distinctDayCount(state) < cfg.outlier.min_history_days) continue; // warmup
const med = median(state.history.map((r) => r.viewCount));
if (med <= 0) continue;
for (const v of decorated) {
  const ratio = v.viewCount / med;
  if (ratio >= cfg.outlier.ratio) channelOutliers.push({ ...v, outlierRatio: Number(ratio.toFixed(2)) });
}
```

### Niche velocity filter

```ts
// pipelines/competitors/lib/scrape.ts:123-131
for (const v of results) {
  const decorated = decorate(v, now);
  if ((decorated.viewsPerDay ?? 0) >= cfg.velocity.views_per_day ||
      decorated.viewCount >= cfg.velocity.total_views) {
    niche.push(decorated);
  }
}
```

`viewsPerDay = viewCount / max(1, daysSincePublish)` (`scrape.ts:39-44`).

## Working-vs-stub verdict

**Working** — provided the `yt-dlp` binary is installed and on `PATH`. The pipeline is resilient: per-channel/per-query failures become `warnings` in the snapshot rather than aborting the run; a channel with insufficient history is skipped (warmup); `median <= 0` is skipped. State persists atomically across runs (`writeJson`).

The only external dependency that can silently degrade output is `yt-dlp` itself (rate-limited / version-broken extractors → empty arrays → "returned 0 videos" warnings, no outliers that day).

## Cross-links

- Consumed by marketing's signal analyzer: [marketing.md](marketing.md)
- Processor / per-tick budget: [../core/03-processor.md](../core/03-processor.md)
