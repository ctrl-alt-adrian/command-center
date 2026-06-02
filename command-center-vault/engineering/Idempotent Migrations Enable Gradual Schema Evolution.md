---
pillar: engineering
title: Idempotent Migrations Enable Gradual Schema Evolution
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - database
  - migrations
  - backward-compatibility
aliases:
  - IF NOT EXISTS patterns
---

Use IF NOT EXISTS patterns in multi-step schema migrations to ensure idempotency, allowing migrations to re-run without error and keeping existing records queryable during transitions.

RoleNext evolved its schema across three versions (v2 to v3 to v4) to support aggregated gap analysis and impact weighting. To maintain backward compatibility, each migration was written as idempotent: creating columns only IF NOT EXISTS, allowing old and new schemas to coexist. This kept existing gap records queryable during the transition and made it safe to retry failed migrations. The pattern is critical when you cannot coordinate a single migration window across all environments or when gradual rollout is required.


## Related

- [[Schema Migration Strategy]]
- [[Zero-Downtime Deployments]]
