---
pillar: engineering
title: Use Varying Timeout Thresholds Based on Request Type
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - fetch
  - timeouts
  - resilience
  - api
aliases:
  - timed-fetch
  - request-timeouts
  - abort-controller
---

Set 30s timeouts for regular requests, 2min for long-lived connections (SSE). Use AbortController.

RoleNext extracted a timedFetch() helper that wraps fetch() with AbortController and timeout logic. Regular requests (GET, POST) abort after 30s; streaming endpoints like SSE abort after 2min. AbortController is cross-browser and doesn't break the fetch promise chain; it throws an AbortError, caught in try-catch. The helper is called from api.ts, avoiding timeout logic scattered across multiple files. This pattern prevents zombie requests that hang indefinitely, tying up connections and confusing users about whether their action succeeded. OWASP and fetch best practices recommend always setting timeouts. The dual threshold (30s vs 2min) is intentional: SSE connections are meant to stay open for streaming events, while regular API calls exceeding 30s are likely stalled.
