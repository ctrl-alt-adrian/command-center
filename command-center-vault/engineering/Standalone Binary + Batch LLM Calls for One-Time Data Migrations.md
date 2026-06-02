---
pillar: engineering
title: Standalone Binary + Batch LLM Calls for One-Time Data Migrations
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - data-migration
  - llm
  - architecture
  - backfill
---

For one-time LLM-driven data backfills, use a standalone binary that batches old data, calls an LLM, and bulk-updates rows—avoiding migration startup blocks and cleanup complexity.

The RoleNext skill gap backfill used a standalone binary at `cmd/backfill-explanations/` rather than a database migration to avoid blocking server startup with LLM calls. Architecture: open the database directly (skip the ORM's migration runner), query distinct stale skills, batch them (20 per LLM call), call a lighter model (GPT-OSS-20B) for efficiency, then bulk-update all rows for each skill. Include retry logic: callGroq retries 3x with exponential backoff; the script adds 60s sleep plus 3 retries on top. Delete the binary after confirming zero stale rows—no maintenance burden since it never enters the permanent codebase. This pattern works for any one-time transformation: you get backpressure control, efficient model selection, and easy disposal.
