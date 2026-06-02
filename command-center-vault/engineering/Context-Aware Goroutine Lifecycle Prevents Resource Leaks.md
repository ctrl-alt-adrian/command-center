---
pillar: engineering
title: Context-Aware Goroutine Lifecycle Prevents Resource Leaks
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - go
  - context
  - lifecycle
  - concurrency
aliases:
  - context-goroutine-pattern
---

Thread context.Context into all async functions. Wrap background goroutines with context.WithTimeout to ensure cleanup and prevent leaks.

Background goroutines without timeouts hang indefinitely if the resource they await disappears. Passing context.Context through all analyzer functions (15+ total) and wrapping background work with context.WithTimeout (5min for resume extraction, 2min for JD analysis) ensures every goroutine has a deadline. When context is cancelled, tickers stop, goroutines exit, and connections release. The rate-limiter goroutine leaked because its ticker had no shutdown signal; making it context-aware fixed the leak. Go's context API forces explicit cancellation rather than ad-hoc signal channels.


## Related

- [[Batch INSERT ON CONFLICT with JSONB Atomicity]]
