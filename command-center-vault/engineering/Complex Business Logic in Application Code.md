---
pillar: engineering
title: Complex Business Logic in Application Code
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - testability
  - readability
---

Derive complex classifications in application code rather than as SQL queries.

The classification algorithm has multiple conditional branches based on disqualifier status, mention count, and match thresholds. Expressing this as a SQL CASE statement is unreadable and hard to test. Pulling data into Go, deriving classifications in code, then bulk-inserting results is clearer and testable. Trade-off: more application load, but readability and maintainability win. Reserve SQL for filtering and aggregation; push business rules into the application tier.


## Related

- [[Entries Table and Full Reaggregation]]
