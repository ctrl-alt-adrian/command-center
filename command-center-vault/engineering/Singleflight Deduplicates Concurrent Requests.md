---
pillar: engineering
title: Singleflight Deduplicates Concurrent Requests
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - concurrency
  - performance
aliases:
  - singleflight-pattern
---

When multiple requests hit the same expensive operation concurrently, run it once and share the result.

YouTube search is expensive: API call, network latency, quota cost. If 5 concurrent job analyses all search for the same skill videos, singleflight ensures only 1 API call is made; the other 4 wait and reuse the result. Prevents thundering herd and quota exhaustion. Go's sync.SingleFlight provides the primitive; apply it anywhere expensive, repeatable work is triggered by concurrent callers.
