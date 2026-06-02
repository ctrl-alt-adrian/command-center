---
pillar: intuition
title: Navigation surfaces need aggressive cache refresh
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - caching
  - strategy
  - mutation
---

On navigation-heavy UIs, use global staleTime:0 for freshness guarantees rather than relying on mutation-scoped invalidateQueries.

When stale tracker data was discovered, the first instinct was to add invalidateQueries in the saveJob mutation handler—invalidate the jobs list after a successful save. Rejected because: (1) it only fixes the save-then-navigate flow, not other staleness vectors like navigating away and back, or seeing changes from other tabs; (2) it treats the symptom, not the contract. The tracker page is a primary data surface where users navigate expecting current state. staleTime:0 makes that contract explicit: whenever you land on this page, you get fresh data. This differs from background data or infrequently-changing surfaces (billing, resumes), which can tolerate longer cache windows and benefit from mutation-scoped invalidation instead.


## Related

- [[Removing staleTime:0 silently lengthens cache window]]
