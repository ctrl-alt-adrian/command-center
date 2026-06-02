---
pillar: engineering
title: Job Cache with Time-to-Live Reduces Extraction Cost
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - optimization
  - ttl
aliases:
  - job description cache
---

Cache extracted job descriptions with a fixed TTL to avoid repeated fetch and extraction.

Popular job postings get checked by many users. RoleNext caches extracted job descriptions with a 48-hour TTL via a JobCacher interface in the scraper layer. On job save, S2 (JD extraction) stores results in the database. On subsequent requests, the cached version is used. This reduces API calls to the job source and eliminates re-parsing the same JD multiple times. Simple pattern: key by job ID, expire after 2 days, fallback to fresh extraction if cache misses.


## Related

- [[Three-Stage Pipeline for Multi-Aspect Reasoning]]
