---
pillar: engineering
title: 'React Query: Invalidate Queries When Mutations Change Server State'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - cache-invalidation
  - mutations
aliases:
  - Cache invalidation on mutation
  - queryClient.invalidateQueries pattern
---

When a mutation succeeds and changes server state, explicitly invalidate all affected React Query keys so components refetch updated data.

A common cache staleness bug: after saveJob() succeeds with a POST, the dashboard skills counter doesn't update. Root cause is missing queryClient.invalidateQueries() calls after the mutation completes. React Query doesn't automatically know which queries are affected by a mutation—you must tell it. Without invalidation, the cache remains fresh (based on staleTime), so refetch only happens when staleTime expires or the component unmounts and remounts. Invalidation marks the query stale and triggers immediate refetch for mounted observers, plus ensures refetch on the next mount even if the component is unmounted when the mutation fires.


## Related

- [[staleTime Zero Anti-Pattern Masks Cache Bugs]]
- [[Mutations Affecting Multiple Queries Need Cascading Invalidation]]
