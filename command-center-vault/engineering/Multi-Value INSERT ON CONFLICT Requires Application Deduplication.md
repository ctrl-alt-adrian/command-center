---
pillar: engineering
title: Multi-Value INSERT ON CONFLICT Requires Application Deduplication
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - postgres
  - upsert
  - batch
---

Bulk upserting multiple rows with ON CONFLICT can produce non-deterministic results across different datasets; deduplicate in application code first.

When using multi-value INSERT with ON CONFLICT, the resolution order depends on input dataset order, leading to non-deterministic outcomes. Deduplicate the batch in application code (e.g., Go map) before constructing the INSERT. This makes behavior predictable and matches your intended semantics. Applied in rolenext PR #172 (SkillGap batch rewrites).
