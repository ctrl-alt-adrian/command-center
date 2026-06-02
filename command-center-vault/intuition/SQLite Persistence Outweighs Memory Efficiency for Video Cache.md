---
pillar: intuition
title: SQLite Persistence Outweighs Memory Efficiency for Video Cache
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - persistence
  - performance
  - trade-offs
aliases:
  - cache-persistence
  - persistence-over-performance
---

When caching ephemeral data like video URLs, persistence across app restarts trumps memory efficiency if cache invalidation is source-specific.

Video playback caches face a fundamental trade-off: in-memory caches are faster but die on app restart, while SQLite persists but uses more memory. For Mirukai, SQLite won because stream URLs are ephemeral and have per-source expiry rules. The persistence value outweighs memory costs for a cache layer serving playback, especially where cold-start latency matters and invalidation logic is already per-source.


## Related

- [[Cache Design Patterns]]
- [[Data Persistence Trade-offs]]
