---
pillar: engineering
title: Cache Schema Versioning Handles Source Deprecation Cleanly
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - migration
  - caching
  - data-management
aliases:
  - migration-safety
---

Bump cache schema version when removing a source, using explicit migration logic to clean orphaned entries without data loss.

When HiAnime was removed, existing cached entries for that source could have become orphans or caused errors. Mirukai incremented the cache schema version and added migration logic to detect and clean old entries. This avoids data loss from hasty deletion and forces a clean transition rather than leaving stale entries to cause runtime errors.


## Related

- [[Migration Safety Patterns]]
- [[Data Lifecycle Management]]
