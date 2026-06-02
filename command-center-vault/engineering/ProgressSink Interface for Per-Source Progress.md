---
pillar: engineering
title: ProgressSink Interface for Per-Source Progress
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - go
  - interface
  - streaming
  - backend
---

Use an interface to decouple progress reporting from scraper logic.

Backend emits per-source SSE events (source_start, source_progress, source_done). Define ProgressSink interface so each scraper (ATS, JSEarch) calls it for progress, decoupling reporting from scraper logic. Mutex-guarded per-source totals aggregate counts as they arrive.


## Related

- [[Interface Segregation]]
- [[Streaming Progress]]
