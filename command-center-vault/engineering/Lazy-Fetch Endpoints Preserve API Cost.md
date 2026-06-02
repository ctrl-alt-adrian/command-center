---
pillar: engineering
title: Lazy-Fetch Endpoints Preserve API Cost
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - cost-optimization
  - lazy-loading
---

Frontend-triggered lazy fetch preserves quota by only requesting data users actually engage with.

When integrating quota-limited APIs, avoid eager fetching during core operations (search, analysis). Instead offer a dedicated endpoint triggered only when users view the relevant section. This keeps the search flow fast, spends quota only on engaged skills, and lets cache hit rate increase naturally. Applied in RoleNext: /api/youtube endpoint called only when users open video cards on Skills or Results pages, not during initial analysis.


## Related

- [[7-Day Cache TTL]]
- [[Singleflight Deduplication]]
