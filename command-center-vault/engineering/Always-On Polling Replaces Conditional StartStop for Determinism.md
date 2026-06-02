---
pillar: engineering
title: Always-On Polling Replaces Conditional Start/Stop for Determinism
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - polling
  - observability
  - resilience
---

Replace start/stop polling with persistent 5s interval and include housekeeping (stale detection, reset) on every tick.

Marketing-pipeline dashboard changed from conditional polling (start on user action, stop on idle) to persistent 5s $effect with cleanup. Before each fetch, the client calls /api/tasks/reset-stale, so stale workers and fresh errors surface within 5 seconds regardless of user activity. This makes error discovery deterministic. The cost is negligible (one API call per 5 seconds) compared to observability gain. Include critical housekeeping on every tick, not as separate side effects.
