---
pillar: engineering
title: TIMESTAMPTZ Across All Temporal Columns
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - schema
  - postgres
  - temporal
aliases:
  - timezone-aware-timestamp
---

Use TIMESTAMPTZ, not TIMESTAMP, for all temporal columns. 18 columns migrated; eliminates timezone ambiguity.

TIMESTAMP without timezone is ambiguous: is 2026-01-01 12:00:00 noon UTC or noon local time? TIMESTAMPTZ stores the offset, removing ambiguity. RoleNext had 18 TIMESTAMP columns across all tables; migrated all to TIMESTAMPTZ. Cost: a single migration script. Benefit: no more timezone bugs, consistent temporal semantics across the schema. Rule: if a column tracks a moment in time (created_at, updated_at, deadline, start), use TIMESTAMPTZ.
