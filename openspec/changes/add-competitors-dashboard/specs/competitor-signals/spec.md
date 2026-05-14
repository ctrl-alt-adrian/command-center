## ADDED Requirements

### Requirement: Competitors pipeline runs daily scrape with two filters

The system SHALL register a `competitors` pipeline with a single phase `scrape` (gate `auto_pass`) triggered by a 10 AM cron. The scrape SHALL pull recent videos from the tracked channels list and recent search results for each niche query, then apply per-channel outlier ratio and niche-query velocity filters to produce a six-tab JSON output at `signals/competitors/<YYYY-MM-DD>.json`.

#### Scenario: Daily scrape fires

- **WHEN** the 10 AM cron POSTs a top-of-pipeline task to the competitors pipeline
- **THEN** a single task runs the scrape phase, writes today's JSON to `signals/competitors/`, and the task transitions to `completed`

#### Scenario: API error during scrape

- **WHEN** the YouTube API returns an error mid-scrape
- **THEN** the phase falls back to yt-dlp for remaining items, records the fallback in the task output, and still produces a JSON output (potentially partial, marked as such)

### Requirement: Per-channel rolling 30-day median is persistent state

The system SHALL maintain a state file per tracked channel at `signals/competitors/state/<channelId>.json` containing the channel's last 30 days of video records (id, publishedAt, viewCount sample taken at scrape time). On each scrape, new records SHALL be appended and records older than 30 days SHALL be removed. Median view count SHALL be computed from this trimmed window.

#### Scenario: First three days for a new channel

- **WHEN** a channel has fewer than 3 days of history in its state file
- **THEN** outlier filtering SHALL skip this channel for the day and the channel's videos appear in the Channels tab without an outlier flag

#### Scenario: Steady-state median computation

- **WHEN** a channel has ≥ 3 days of history
- **THEN** today's median is computed from up to 30 days of records and each of today's videos has `outlier_ratio = views / median` attached

### Requirement: Outlier ratio and velocity thresholds

The system SHALL flag a tracked-channel video as `outlier` when `outlier_ratio ≥ 2.0`. The system SHALL flag a niche-query result as `niche_pass` when `viewsPerDay ≥ 5000` OR `totalViews ≥ 100_000`. Both thresholds SHALL be configurable via `pipelines/competitors/config.yaml`.

#### Scenario: Video meets outlier threshold

- **WHEN** a tracked-channel video's view count divided by the channel's 30-day median is ≥ 2.0
- **THEN** the video appears in the Outliers tab and contributes to the Top tab's ranking

#### Scenario: Niche video meets velocity threshold

- **WHEN** a niche-query result has viewsPerDay ≥ 5000 OR totalViews ≥ 100k
- **THEN** the video appears in the Niche tab

### Requirement: JSON output structure has six tabs

The daily JSON SHALL contain six top-level arrays: `top`, `outliers`, `niche`, `channels`, `shorts`, `archive` (a pointer to yesterday's file). Each entry SHALL include: `videoId`, `title`, `channelId`, `channelTitle`, `publishedAt`, `viewCount`, `viewsPerDay`, `outlier_ratio` (if applicable), `thumbnails`, `url`, `isShort`.

#### Scenario: JSON is read by both consumers

- **WHEN** `/competitors` and marketing's External Signals subagent read the same `signals/competitors/<date>.json`
- **THEN** both consumers see the same six-tab structure and entry fields with no transformation step
