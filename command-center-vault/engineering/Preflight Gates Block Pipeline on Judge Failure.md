---
pillar: engineering
title: Preflight Gates Block Pipeline on Judge Failure
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - circuit-breaker
  - pipeline-gates
  - judge-eval
  - robustness
---

Use canaries as circuit breakers: if a judge fails to score a known-bad case correctly, block the entire pipeline from running.

In RoleNext, judges are checked against their canary examples before pipeline execution. If a judge fails to correctly identify a known-bad case, the pipeline fails fast instead of accumulating bad data downstream. This is a circuit-breaker pattern: one bad actor stops the whole system. Implemented as an optional --preflight flag, so developers can skip it during iteration (faster feedback loops) but it's mandatory in production autonomous runs (Ralph loops). The cost of forgetting the flag is wasted tokens, not corrupted evaluation data.


## Related

- [[Circuit Breaker Pattern]]
- [[Pipeline Robustness]]
