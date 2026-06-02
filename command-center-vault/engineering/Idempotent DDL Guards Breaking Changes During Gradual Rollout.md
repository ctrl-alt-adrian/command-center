---
pillar: engineering
title: Idempotent DDL Guards Breaking Changes During Gradual Rollout
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - migrations
  - database
  - backward-compatibility
---

Use CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS patterns to allow old code to coexist with new database constraints during gradual rollout.

Enforcing database SSL encryption cannot flip on instantly without breaking connections still using unencrypted clients. RoleNext used idempotent migration DDL that detects whether encryption was already required, allowing the constraint to roll out incrementally across environments. Old clients continue working until upgraded; new clients connect with SSL required. The pattern applies to any breaking database change that needs coordinated rollout across multiple service versions.
