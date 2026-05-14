## Context

The captain has no audience yet but is pre-revenue with a working product (RoleNext). External signals are the cheapest way to ground content in what is actually moving in the niche right now — and the cheapest way to discover that is YouTube outlier feeds in adjacent creator spaces (Joma, Mayuko, TechLead, ThePrimeagen, indie-hacker channels shipping career tools). The docx's design is doing two things: (1) per-channel normalization so we measure spikes against the creator's own baseline, and (2) a velocity floor on niche queries so undiscovered content surfaces even from accounts with no track record.

## Goals / Non-Goals

**Goals:**
- One JSON output that both `/competitors` and the marketing External Signals subagent read.
- Per-channel rolling 30-day median maintained as durable state so the system doesn't need to recompute from scratch each day.
- Six dashboard tabs the captain can actually browse without spinning up an agent.
- Outlier feed is itself a content source: a `Build-in-Public Trends` query on it produces post candidates directly.

**Non-Goals:**
- Other platforms (X, LinkedIn, Substack) — those are separate, in a later phase if needed. The docx names the YouTube case explicitly.
- Embedding-based topical clustering. Tag-based + naive frequency is enough.
- Auto-posting commentary on outlier videos. Always captain-gated through the marketing pipeline.

## Decisions

**1. YouTube Data API v3 by default, yt-dlp fallback.** API quota is 10,000 units/day on free tier. A `videos.list` call costs 1 unit, `search.list` costs 100. 15 channels × `playlistItems.list` (1 unit) for recent uploads + 22 queries × `search.list` (100 each) = 15 + 2200 = 2215 units/day. Comfortable margin. Alternative: yt-dlp metadata scrape. Slower but unlimited. Default to API for reliability; document fallback.

**2. Rolling median state in `signals/competitors/state/<channelId>.json`.** Each channel keeps its last 30 days of video stats. On each scrape, append today's videos and trim entries older than 30 days. Median is recomputed from the trimmed set. Alternative: compute from scratch each run. Rejected — quota-expensive after week 1.

**3. Outlier threshold is `≥ 2.0` ratio, niche velocity is `≥ 5000 vpd OR ≥ 100k total`.** Straight from the docx. Make both configurable.

**4. Six-tab dashboard structure matches the docx exactly:** Top (top-N by score), Outliers (per-channel ratio ≥ 2.0), Niche (velocity-passing query results), Channels (per-channel browse), Shorts (vertical filtered), Archive (yesterday and prior).

**5. Single task per cron run, not one task per video.** The scrape is a single phase, gate `auto_pass`, writing `signals/competitors/<date>.json`. The task is a marker that the file exists; the dashboard reads the file. Alternative: one task per outlier. Rejected — would blow through the task store fast and conflate "I have a signal" with "I have something to act on" (the marketing pipeline already handles the "act on it" loop).

**6. External Signals subagent reads `signals/competitors/<latest>.json`.** Marketing-pipeline already reads `signals/`; the path convention is additive. Zero changes to the subagent's prompt structure needed; only the input file grows.

## Risks / Trade-offs

- [Risk] YouTube API quota exhaustion → Mitigation: tracked quota usage logged per run; fallback to yt-dlp on quota error; alarm if quota usage > 80% of daily budget.
- [Risk] Channel renames or deletions break the rolling-median state → Mitigation: state file keyed by channel ID, not name. Renames are invisible to us.
- [Risk] Scraping over-fits to YouTube — the docx mentions X/HN/Dev.to too. → Acknowledged. The existing marketing-pipeline `fetch-signals.sh` covers those today; this phase adds the YouTube layer specifically. Other sources can move into `pipelines/competitors/` later under separate sub-configs.

## Migration Plan

1. Build scraper and rolling-median state against the API.
2. Run for 3 days to seed the rolling median before any filter triggers (filters skip channels with < 3 days of history).
3. Open `/competitors` page; verify tabs render with real data.
4. Update marketing's External Signals subagent reference from the existing signals files to the new competitors file (additively — both still read).

Rollback: delete `pipelines/competitors/`, remove cron entry, remove `/competitors` route. No state outside command-center.

## Open Questions

- Niche queries list: starter set from the docx (`"AI resume builder"`, `"system design interview"`, `"got laid off tech"`, `"FAANG resume review"`) — confirm this matches the captain's positioning before lock-in. Recommend captain reviews the YAML before phase 4 ships.
- Should the dashboard also support per-channel watchlists (add/remove from UI), or is YAML-file editing the only path? Recommend YAML-only for phase 4; add UI in a later iteration if it bites.
