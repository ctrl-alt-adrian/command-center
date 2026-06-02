---
pillar: engineering
title: Judge Cases Catch Quality Regressions in Isolation
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - heuristics
  - quality
aliases:
  - Edge Case Test Validation
---

Explicit test cases for edge cases catch heuristic regressions that look good in aggregate metrics.

When validating heuristic scoring for intent refinement, aggregate metrics can hide regressions. Adding explicit test cases for known failure modes—queries that produce hallucinated skills, queries where heuristics incorrectly block refinement—exposed issues that looked fine in overall validation. Judge cases should cover clear passes, clear fails, and boundary cases, not just happy paths. This catches regressions that metrics alone would miss.


## Related

- [[Gate LLM Refinement With Heuristic Pre-filters]]
