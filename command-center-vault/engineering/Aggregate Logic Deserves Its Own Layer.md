---
pillar: engineering
title: Aggregate Logic Deserves Its Own Layer
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - separation-of-concerns
  - testability
  - database-layer
---

Isolate scoring logic in a dedicated abstraction layer to improve testability and API transparency.

RoleNext refactored skill-gap aggregation by extracting impact-weighted calculations into `skill_gap_aggregate.go`, separate from raw gap retrieval. This made scoring rules testable in isolation and transparent to API consumers. Pushing aggregation to the database layer also keeps the API contract stable: if weighting logic changes, the response structure doesn't. Trade-off: adds one more layer to trace, but clarity and testability pay for themselves when scoring rules evolve.
