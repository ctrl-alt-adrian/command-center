## ADDED Requirements

### Requirement: /competitors route exposes six-tab browse view

The system SHALL serve `/competitors` rendering six tabs in this order: Top, Outliers, Niche, Channels, Shorts, Archive. Each tab SHALL render a card grid with thumbnail, title, channel, key metric (view count or outlier ratio), and a click-through to the YouTube URL.

#### Scenario: Captain browses outliers

- **WHEN** the captain visits `/competitors` and clicks the Outliers tab
- **THEN** the page shows today's outlier-flagged videos sorted by outlier_ratio descending

#### Scenario: Captain browses by channel

- **WHEN** the captain clicks the Channels tab and selects a channel
- **THEN** the page shows that channel's recent videos with each video's outlier_ratio against the channel's own median

#### Scenario: Captain views archive

- **WHEN** the captain clicks the Archive tab
- **THEN** the page lists prior days' JSON files with date labels and links to per-day views

### Requirement: Dashboard reads same JSON as the agent

The system SHALL NOT duplicate filtering or scoring logic between `/competitors` and any agent consumer. Both SHALL read `signals/competitors/<date>.json` and render or interpret it directly.

#### Scenario: A filter threshold change

- **WHEN** the captain updates `pipelines/competitors/config.yaml` thresholds and the next scrape runs
- **THEN** `/competitors` reflects the new thresholds without any dashboard code change
