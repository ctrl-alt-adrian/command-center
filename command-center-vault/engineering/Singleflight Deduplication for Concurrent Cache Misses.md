---
pillar: engineering
title: Singleflight Deduplication for Concurrent Cache Misses
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - concurrency
  - cache
  - thundering-herd
  - quota
---

Use singleflight to collapse concurrent requests for the same uncached resource.

When 50 users view the same skill gap simultaneously and hit a cache miss, naive code fires 50 API calls. golang.org/x/sync/singleflight ensures only one API call executes; all concurrent requests wait for the result. Critical for quota-limited APIs where redundant calls compound cost quickly. Applied in RoleNext YouTube integration: concurrent requests for the same skill collapse into a single API call, reducing quota burn.


## Related

- [[7-Day Cache TTL]]
- [[Lazy-Fetch Endpoints]]
