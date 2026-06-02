---
pillar: intuition
title: staleTime Zero Anti-Pattern Masks Cache Bugs
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - cache-strategy
  - debugging
aliases:
  - Don't use staleTime zero as a workaround
---

Setting staleTime:0 to force refetches hides the real problem: mutations that don't invalidate their affected queries.

When a dashboard query shows stale data after a mutation, the temptation is to set staleTime:0 on the dashboard component to force refetch on every mount. This is a band-aid. The root cause is that the mutation (for example, saveJob) never called invalidateQueries, so the cache doesn't know the data changed. Setting staleTime:0 masks the bug and wastes cache—every navigation back to the dashboard triggers an unnecessary refetch. The right fix is to invalidate the correct queries from the mutation. This way, the global staleTime (typically 2 minutes) works as intended: cached data stays fresh across navigations, but mutations immediately invalidate affected queries.


## Related

- [[React Query: Invalidate Queries When Mutations Change Server State]]
