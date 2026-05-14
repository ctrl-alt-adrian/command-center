## 1. Config and Lists

- [ ] 1.1 Author `pipelines/competitors/config.yaml` with thresholds (outlier 2.0, velocity 5000 vpd or 100k total) and an `enabled` flag
- [ ] 1.2 Author `pipelines/competitors/channels.yaml` with the starter 15 SWE / career / indie-hacker creators
- [ ] 1.3 Author `pipelines/competitors/queries.yaml` with the starter ~22 niche queries
- [ ] 1.4 Add `YOUTUBE_API_KEY` to `.env.example` as optional

## 2. Scraper

- [ ] 2.1 Implement `pipelines/competitors/lib/youtube-api.ts`: thin wrapper around `playlistItems.list` (channel uploads) and `search.list` (niche queries) with quota accounting
- [ ] 2.2 Implement `pipelines/competitors/lib/yt-dlp-fallback.ts`: shell out to `yt-dlp --dump-json` for fallback
- [ ] 2.3 Implement `pipelines/competitors/lib/scrape.ts` orchestrating both, returning normalized video records
- [ ] 2.4 Filter Shorts via duration < 60s OR `#shorts` in title; tag isShort

## 3. Rolling Median State

- [ ] 3.1 Implement `pipelines/competitors/lib/state.ts`: read/append/trim per-channel state file
- [ ] 3.2 Implement median computation over the trimmed window
- [ ] 3.3 Unit test: 3-day warmup skip, steady-state median, eviction at day 31

## 4. Filters

- [ ] 4.1 Apply outlier ratio per tracked-channel video (skip channels < 3 days history)
- [ ] 4.2 Apply velocity filter per niche-query result
- [ ] 4.3 Build the six output arrays (top, outliers, niche, channels, shorts, archive pointer) into one JSON file

## 5. Pipeline Registration

- [ ] 5.1 Author `pipelines/competitors/pipeline.config.ts` (single phase, auto_pass)
- [ ] 5.2 Wire into registry
- [ ] 5.3 Add 10 AM cron entry

## 6. /competitors Surface

- [ ] 6.1 Build `/competitors` route with six tabs
- [ ] 6.2 Build card grid component (thumbnail, title, channel, metric, click-through)
- [ ] 6.3 Build per-channel drill-down view from Channels tab
- [ ] 6.4 Build archive list view

## 7. Marketing Hookup

- [ ] 7.1 Update marketing-pipeline's External Signals subagent prompt to include `signals/competitors/<latest>.json` as an input source
- [ ] 7.2 Verify: a discovery run after a competitors scrape includes outlier-driven candidates

## 8. Warmup and Verification

- [ ] 8.1 Run scraper manually for 3 days to seed state
- [ ] 8.2 Verify `/competitors` renders with real data on day 3
- [ ] 8.3 Verify quota usage stays under 50% of daily budget
