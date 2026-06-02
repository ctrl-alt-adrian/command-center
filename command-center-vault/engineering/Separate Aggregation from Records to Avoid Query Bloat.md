---
pillar: engineering
title: Separate Aggregation from Records to Avoid Query Bloat
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - database
  - performance
  - aggregation
  - query-design
aliases:
  - aggregation layer pattern
  - defer to database
---

When computing aggregated metrics across many records, compute the aggregation in the database layer with GROUP BY and ranking rather than fetching raw records and computing in the application.

RoleNext's skill gap system initially computed impact-weighted rankings in the application layer after fetching all gap records. This created O(N) query overhead. The solution: move aggregation to PostgreSQL using GROUP BY with impact weighting applied in the query itself. Raw gap records stay stored as-is; the database layer produces the ranked, aggregated view users see. This separation of concerns lets you change aggregation logic without touching data structure. The pattern applies to any system where raw records need ranked, filtered, or scored output.


## Related

- [[Database-Driven Computation]]
- [[Query Optimization Patterns]]
