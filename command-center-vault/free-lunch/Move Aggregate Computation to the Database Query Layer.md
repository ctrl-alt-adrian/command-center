---
pillar: free-lunch
title: Move Aggregate Computation to the Database Query Layer
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - database
  - aggregation
  - performance
  - computational-boundaries
aliases:
  - push computation down
  - query-layer aggregation
---

Pre-computing weighted aggregates in the database cuts latency and network transfer without sacrificing flexibility.

RoleNext initially computed impact-weighted skill gaps in application code: fetch raw data, apply weights. Moving aggregation to a `skill_gap_aggregate` table query flipped the economics—single database query returns pre-weighted results, reducing network transfer and leveraging PostgreSQL for the math. Weights and algorithms still tune at the query layer, so flexibility remains. Use this pattern when aggregations are expensive or needed repeatedly across different views.


## Related

- [[Database Schema Design]]
- [[Computational Boundaries]]
