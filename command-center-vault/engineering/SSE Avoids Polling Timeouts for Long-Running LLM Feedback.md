---
pillar: engineering
title: SSE Avoids Polling Timeouts for Long-Running LLM Feedback
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - streaming
  - sse
  - llm
  - architecture
---

Use SSE for streaming LLM refinement feedback instead of polling, avoiding timeout and latency issues.

The search quality system streams LLM refinement feedback to the frontend over SSE rather than polling or waiting for a batch response. SSE handles long-running operations cleanly: the server pushes updates as they arrive, the client receives them as streams. This avoids timeout issues and lets the UI update early as feedback arrives. Polling would add latency and complexity; batch processing would block the user.


## Related

- [[Streaming patterns]]
- [[Long-running operations]]
