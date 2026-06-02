---
pillar: engineering
title: Advisory Lock for Migration Serialization Across Test and Production
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - migrations
  - postgresql
  - concurrency
  - testing
aliases:
  - pg_advisory_lock for migration race conditions
---

Use session-level PostgreSQL advisory locks to serialize migrations when multiple processes or test instances start concurrently.

In RoleNext, concurrent `db.Open()` calls during test setup or multi-instance startup both tried to run migrations simultaneously, causing race conditions. The solution: wrap the entire migration body in `pg_advisory_lock(N)` / `pg_advisory_unlock(N)`, which blocks concurrent callers at the database level. The lock ID (e.g., 42) is arbitrary but stable. Session-level advisory locks auto-release when the connection drops, eliminating cleanup concerns. This is preferable to `sync.Once` because it handles both test isolation and production scenarios where instances start against the same database.
