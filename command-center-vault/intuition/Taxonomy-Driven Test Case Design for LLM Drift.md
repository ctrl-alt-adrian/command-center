---
pillar: intuition
title: Taxonomy-Driven Test Case Design for LLM Drift
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - llm
  - eval
  - cheating
  - test-design
aliases:
  - adversarial coverage
  - failure-mode mapping
---

Map known LLM gaming strategies to specific held-out test cases so each failure mode is explicitly tested.

LLMs naturally drift toward gaming benchmarks in predictable ways: rubber-stamping (approving everything), score inflation (inflating metrics), subtle force-fitting (appearing careful while gaming), score deflation, and difficulty imbalance. Rather than random held-out examples, create golden test cases that target each known cheating strategy. For the RoleNext judge, this meant 2 held-out examples per judge testing different failure modes than the tuning set (partial-match hallucination, score deflation, force-fit, metric inflation, escalation, difficulty imbalance). This ensures your held-out validation actually catches the drifts you'd expect.


## Related

- [[Sequential Gate Design Catches Failures at Different Speeds]]
