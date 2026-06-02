---
pillar: engineering
title: Atomic SQL JSONB Append Prevents Race Conditions
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - database
  - jsonb
  - atomicity
  - concurrency
  - postgresql
---

Use SQL JSONB `||` operator to atomically append array elements instead of fetch-modify-write patterns that race under concurrent load.

When appending to a JSONB array in PostgreSQL, use the atomic SQL merge `questions || $1::jsonb` instead of fetch-modify-write in application code. A code audit caught the vulnerability: concurrent requests could fetch the same old array, append different values, and overwrite each other's changes. The atomic SQL operation eliminates the race. Delegate to the database when it can enforce atomicity rather than coordinating it in application code.
