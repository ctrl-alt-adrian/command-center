---
pillar: engineering
title: SSE for LLM Streaming Over Polling
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - streaming
  - sse
  - architecture
  - latency
  - llm
aliases:
  - server-sent-events
  - streaming-pattern
---

Server-Sent Events eliminates polling overhead and improves UX latency perception for LLM-driven features.

When you need the client to receive LLM results as they stream, SSE beats polling. No round-trip overhead, no client-side retry logic, no latency from poll intervals. In RoleNext's intent refinement, SSE pipes suggestions directly to the browser as the LLM generates tokens, eliminating perceived wait time. Clients just listen; server pushes. The pattern scales better than polling (fewer wasted requests) and feels more responsive because results arrive immediately rather than waiting for the next poll interval.


## Related

- [[Multi-Signal Intent Detection with Streaming]]
