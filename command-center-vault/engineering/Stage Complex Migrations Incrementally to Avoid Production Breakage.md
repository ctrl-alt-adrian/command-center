---
pillar: engineering
title: Stage Complex Migrations Incrementally to Avoid Production Breakage
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - migrations
  - database
  - risk-reduction
  - production-safety
---

Staging v3 and v4 migrations incrementally reduces production risk when refactoring complex data shapes.

The skill gap refactor touched core scoring logic and required schema changes to support impact-weighted classifications and rationale storage. Rather than a single migration, the team staged v3 (schema foundation) and v4 (data structure) separately. This incremental approach let production queries keep working during the transition — each step was minimal and reversible. Complex refactors feel safer when you can deploy and validate at each stage instead of betting everything on one cutover.
