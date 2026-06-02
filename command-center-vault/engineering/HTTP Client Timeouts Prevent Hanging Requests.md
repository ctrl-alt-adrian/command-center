---
pillar: engineering
title: HTTP Client Timeouts Prevent Hanging Requests
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - http
  - timeout
  - reliability
aliases:
  - http-timeout-pattern
---

Replace http.DefaultClient with timeout-configured clients. 10+ call sites had no timeout; requests could hang indefinitely.

http.DefaultClient has no timeout. If a remote service hangs, your goroutine hangs. RoleNext called OpenAI and YouTube APIs from 10+ code paths, all using DefaultClient. Added 30-second timeouts to HTTP clients (configured at handler level, threaded through callers). This prevents cascading failures: if YouTube search hangs, the job analysis request times out and retries instead of consuming goroutines indefinitely. Timeouts should be set based on SLA expectations, not copied from examples.
