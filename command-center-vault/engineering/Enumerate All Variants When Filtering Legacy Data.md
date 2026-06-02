---
pillar: engineering
title: Enumerate All Variants When Filtering Legacy Data
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - data-migration
  - backfill
  - filtering
---

When filtering old-style data during a migration, enumerate all variants of the old pattern—case variations, phrasing differences, and edge cases you might miss.

The RoleNext skill gap backfill initially missed explanations referencing 'the candidate' because the filter only checked for 'resume', 'JD', 'job description', and empty strings. Examples that slipped through: 'The candidate lists BigQuery but not Snowflake' and 'the candidate's background does not show exposure to such data.' The fix: add `ILIKE '%candidate%'` since the new explanation tone never references candidates. Case variations matter too—use ILIKE for case-insensitive matching of old phrasing. The insight: when filtering legacy data, don't assume the obvious phrases cover all cases. The old style appears in the wild in ways you won't predict without looking at actual records.
