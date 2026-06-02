---
pillar: engineering
title: JSONL Append-Only Error Log with Probabilistic Pruning
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - observability
  - logging
  - error-handling
---

Use append-only JSONL for error logs with probabilistic pruning to prevent unbounded growth.

Marketing-pipeline error infrastructure (lib/errors.ts) writes to dashboard/tasks/.errors.log as JSONL with logError(source, taskId, stage, error). Each write checks if the file exceeds 500 entries and, with 20% probability, prunes older lines. This bounds the file without locking. GET /api/errors reads the full log (display expandable rows per error), DELETE /api/errors or per-row dismiss clears entries. Include source badges, stack traces, and task IDs so errors are traceable. SSR-preload errors on page load.
