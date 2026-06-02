---
pillar: intuition
title: Complete Source Removal Reduces Maintenance Surface Over Feature-Flagging
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - deprecation
  - maintenance
  - code-cleanup
  - decision-making
aliases:
  - clean-deprecation
  - maintenance-burden
---

When deprecating a data source, total removal creates a clean break and lower maintenance cost than soft-deprecation via feature flags.

Mirukai could have feature-flagged HiAnime off, leaving the code in place but disabled. Instead, the team removed it entirely. Feature flags create persistent soft-deprecated code paths that accumulate testing surface, conditional logic, and cognitive load. Clean removal forces a break and keeps the codebase simpler, trading one-time removal work for lower long-term maintenance cost.


## Related

- [[Technical Debt Management]]
- [[Deprecation Strategies]]
