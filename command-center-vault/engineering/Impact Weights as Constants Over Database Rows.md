---
pillar: engineering
title: Impact Weights as Constants Over Database Rows
tier: 2
content_ready: false
created: '2026-05-14'
tags:
  - configuration
  - database-design
  - scoring
aliases:
  - scoring weights storage
---

Store impact weights as code constants rather than database rows when they are tuning parameters for a fixed algorithm, not user-facing configuration.

When implementing impact-weighted skill gap ranking, RoleNext chose to store weights as constants in `types.go` rather than database rows. This prioritizes auditability (weights live in version control and code review) and cache simplicity (no cache invalidation when scoring logic changes) over runtime flexibility. The trade-off makes sense when weights are parameters for a fixed algorithm. If weights become user-configurable or require frequent tuning without code changes, move to the database.


## Related

- [[Configuration vs Code]]
- [[Audit Trails and Version Control]]
