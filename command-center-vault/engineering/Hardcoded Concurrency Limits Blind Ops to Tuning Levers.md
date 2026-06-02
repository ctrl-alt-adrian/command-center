---
pillar: engineering
title: Hardcoded Concurrency Limits Blind Ops to Tuning Levers
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - concurrency
  - ops
  - tuning
aliases:
  - parameterize limits
---

When LLM fan-out concurrency is hardcoded (e.g., `make(chan struct{}, 5)`), ops can't tune for load. Expose it as an environment variable to make the trade-off visible and settable.

Job-search analyzer had `make(chan struct{}, 5)` hardcoded in two places, limiting concurrent LLM requests per batch to 5. If load increases or latency tightens, ops had no lever. Solution: expose as `ANALYZER_LLM_CONCURRENCY` env var (default 15) and parse it in main. Add a helper `ResolveLLMConcurrency(string) int` that validates input and logs the value at startup. Now ops can tune memory/latency trade-offs at deploy time, and monitoring can correlate concurrency settings with performance.


## Related

- [[Parallel Stage 1 Extraction Shortens Critical Path]]
