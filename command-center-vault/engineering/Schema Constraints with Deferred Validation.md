---
pillar: engineering
title: Schema Constraints with Deferred Validation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - postgres
  - migrations
  - constraints
aliases:
  - NOT VALID Pattern
---

Add CHECK constraints to large tables with NOT VALID first, then VALIDATE in a separate transaction to avoid locks.

Adding a CHECK constraint to a large, active table triggers full-table validation, locking it and blocking other queries. Instead, create the constraint with NOT VALID (which skips validation), then VALIDATE it in a follow-up transaction after the migration completes. Keeps downtime minimal. Applied in rolenext PR #173 (6 CHECK constraints plus 7 NOT NULL migrations added safely).
