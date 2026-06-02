---
pillar: engineering
title: Streaming Incremental Output Feels Faster Than Waiting for Completion
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - ux
  - streaming
  - latency
  - llm-integration
aliases:
  - server-sent-events
  - progressive-rendering
---

Server-sent events showing partial suggestions as they stream reduces perceived wait time compared to blocking on full response.

LLM refinement calls return suggestions via SSE rather than blocking until complete. Users see suggestions appearing incrementally, which feels snappier than a blank screen then full response. Even though total latency might be the same, streaming distributes the wait and shows progress. Applies to any LLM-in-the-loop feature where output is incremental (writing suggestions, code, refinement).


## Related

- [[Keystroke Debounce]]
