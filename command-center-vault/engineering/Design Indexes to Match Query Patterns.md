---
pillar: engineering
title: Design Indexes to Match Query Patterns
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - database
  - indexes
  - query-optimization
---

Composite indexes should match how queries actually filter and sort. An index on (user_id, created_at DESC) is better than two separate indexes if queries filter by user_id and sort by created_at.

Added user_id indexes to four tables in RoleNext. On search_history, used a composite index on (user_id, created_at DESC) because all queries filter by user_id and sort by created_at descending. This tighter index means the database can walk it in the right order without a separate sort step. Check your actual query patterns before designing indexes.
