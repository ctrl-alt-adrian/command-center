---
pillar: engineering
title: Removing staleTime:0 silently lengthens cache window
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - caching
  - configuration
  - navigation
---

Deleting an explicit staleTime:0 config reverts to React Query's default multi-minute cache, breaking data freshness in navigation-heavy UIs without any code-path changes.

In RoleNext's TrackerPage, a cleanup commit removed staleTime:0 from the jobs query config. Result: queries now cached for 5+ minutes instead of refetching on every mount. Job saves from the search page stayed invisible on the tracker, and skill-gap deletions didn't show until the user manually refreshed. The fix was restoring the single line. Lesson: explicit staleTime values exist for a reason. When a navigation surface (like a dashboard or tracker) needs current data on every visit, staleTime:0 isn't a nice-to-have—it's the contract. Removing it as cleanup is a footgun because the default behavior is silent and hard to debug.


## Related

- [[Navigation surfaces need aggressive cache refresh]]
