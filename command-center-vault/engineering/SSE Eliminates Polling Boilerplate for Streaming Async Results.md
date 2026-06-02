---
pillar: engineering
title: SSE Eliminates Polling Boilerplate for Streaming Async Results
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - sse
  - streaming
  - async-patterns
  - client-server
---

Server-Sent Events provide cleaner semantics than polling when pushing real-time suggestions to the client after async processing.

In rolenext, when a low-quality intent needs LLM refinement, the backend streams suggestions in real time using SSE instead of asking the client to poll. SSE reduces client-side complexity: no poll loop, no backoff logic, no "is the result ready" status checks. The server pushes data as it becomes available; the client consumes a stream. For short-lived async operations (refinement completes in seconds), SSE is cleaner and more efficient than REST polling.
