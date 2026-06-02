---
pillar: engineering
title: Two-Pronged Cache Invalidation After Deletion
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - cache-invalidation
  - deletion
  - data-integrity
  - database
aliases:
  - Defense in depth for stale data
  - Query guard plus cleanup
---

Combine query-time guards with delete-time cleanup to prevent stale data from reaching users, even when the write path has edge cases.

In the rolenext interview-prep system, a bug left orphaned skill_gap_summary rows visible after users deleted all their saved jobs. The root cause was a cleanup function that silently skipped skills it couldn't find in the skill_gap table. Rather than just fix the cleanup, the fix added two independent defenses: (1) a COUNT(*) guard at the top of GetSkillGaps that returns empty immediately if the user has zero saved jobs, and (2) a ClearSkillGapSummary cleanup that runs after the last job is deleted. Either defense alone would have fixed the user-visible bug, but together they provide defense in depth. The query guard is the more critical one. It catches future edge cases where summary rows outlive their source data, regardless of how the data got stale. The delete-time cleanup is proactive bookkeeping. Both are cheap relative to the confidence they provide.


## Related

- [[Per-User Cache Layer Decoupling for Personalization]]
