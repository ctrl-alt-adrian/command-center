---
pillar: engineering
title: 7-Day Cache TTL for API Cost Control
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - api-quota
  - cost-optimization
---

Lazy API refresh with 7-day TTL scales cheaper than daily refresh when quota is constrained.

At scale (200+ cached skills), refreshing all entries daily requires ~20,000 API units/day, exceeding free quota limits like YouTube's 10,000/day. Switching to 7-day TTL with lazy refresh (only refresh skills users request) stays within quota while maintaining freshness. The tech skills universe is bounded (~500-1000 terms), so cache hit rate approaches 95%+ and most entries never trigger refresh. Applied in RoleNext YouTube integration (Mar 2026).


## Related

- [[Lazy-Fetch Endpoints]]
- [[Singleflight Deduplication]]
