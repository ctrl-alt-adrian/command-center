---
pillar: engineering
title: Trends require database-layer time-series aggregation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - analytics
  - architecture
  - database
  - aggregation
  - time-series
---

Computing trend analysis from a single snapshot is impossible; trends must be aggregated at the database layer from historical data.

Building analytics features that show progression (sparklines, deltas) requires a fundamentally different data architecture than features showing current state. You can't compute a trend from a single database query result. RoleNext solved this by storing historical skill gap data points in PostgreSQL JSONB and aggregating them at query time, rather than trying to backfill trends from point-in-time snapshots. This architectural decision shapes whether your analytics can scale: early adoption of time-series thinking avoids expensive migrations later.
