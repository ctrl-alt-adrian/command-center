---
pillar: engineering
title: Unified Cache Identity Across Heterogeneous Source Implementations
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - abstraction
  - schema-design
aliases:
  - cache-unification
---

Episode list and stream URL can share a single cache identity key, letting sources with different scraping strategies use the same schema.

Mirukai caches two pieces of playback data: episode lists and stream URLs. Rather than separate cache tables per source, a unified identity key (source + episode ID) lets HTML scrapers and API sources coexist in one table. This reduces schema complexity and lets sources differ in scraping strategy without duplicating cache logic.


## Related

- [[Cache Design Patterns]]
- [[Schema Unification]]
