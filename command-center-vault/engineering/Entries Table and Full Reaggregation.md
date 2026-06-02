---
pillar: engineering
title: Entries Table and Full Reaggregation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - aggregation
  - data-architecture
  - signal-preservation
---

Store raw signal entries as the source of truth and recompute aggregates fully instead of using incremental counters.

The old approach used incremental counters (ON CONFLICT DO UPDATE SET count = count + 1), which discarded per-job context: disqualifier status, category, match score. Switching to an entries table preserves every gap signal. Aggregation becomes a full recompute from entries, then bulk-insert summaries. Trade-off: compute cost is higher than incremental updates, but manageable for reasonable dataset sizes. Correctness by construction makes the trade-off worth it. Pattern applies wherever you're aggregating multi-dimensional signals and cannot afford to lose context.


## Related

- [[Backpressure and Reaggregation]]
- [[Correctness by Construction]]
