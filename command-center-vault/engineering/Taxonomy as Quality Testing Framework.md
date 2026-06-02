---
pillar: engineering
title: Taxonomy as Quality Testing Framework
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - taxonomy
  - testing
  - quality
  - heuristics
  - auditability
aliases:
  - classification-for-testability
  - explicit-intent-types
---

Explicit intent classification makes heuristic quality rules testable and auditable instead of opaque.

Rather than burying quality judgments in code, build an explicit taxonomy of intent problems and map heuristics to categories. RoleNext's intent system classifies searches as overqualified, too-broad, unclear-title, or hallucinated-skills. Each category has testable rules; calibration cases verify the classification logic works. The payoff: subjective judgments become machine-evaluable. You can write test cases, measure coverage, and reason about edge cases. Marketing can explain why a search got flagged, not just 'the AI said so'.


## Related

- [[Detecting Hallucinated Skills in Job Searches]]
