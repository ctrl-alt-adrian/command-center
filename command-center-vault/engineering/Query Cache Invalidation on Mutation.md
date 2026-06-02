---
pillar: engineering
title: Query Cache Invalidation on Mutation
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - cache
  - mutations
  - react-query
---

Deleting a domain object can affect queries that don't directly depend on it.

In the RoleNext dashboard, deleting a job didn't update the cached skill matches. The delete mutation wasn't invalidating the skills query, causing stale data. Fix: add queryClient.invalidateQueries({ queryKey: queryKeys.skills.all }) to the delete mutation's onSettled handler. Mutation side effects can have non-obvious cross-cutting query dependencies. Don't assume invalidateQueries only needs to target queries directly operating on that data.
