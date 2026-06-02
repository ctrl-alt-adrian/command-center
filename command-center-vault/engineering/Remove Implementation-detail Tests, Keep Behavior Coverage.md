---
pillar: engineering
title: Remove Implementation-detail Tests, Keep Behavior Coverage
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - test-strategy
  - maintainability
aliases:
  - behavior-focused tests
---

Trim tests that assert on internal state or mock call counts; retain focused tests for observable behavior and integration points.

The rolenext test cleanup removed 650+ lines of tests that verified implementation details—mock invocation counts, internal state transitions—rather than behavior. This reduces maintenance burden when internal code changes and improves test signal. Keep tests for core behaviors that matter: title normalization correctness and composite scraper orchestration. The discipline is: if a test would break when you refactor internals but the feature still works, it is testing the wrong thing.
