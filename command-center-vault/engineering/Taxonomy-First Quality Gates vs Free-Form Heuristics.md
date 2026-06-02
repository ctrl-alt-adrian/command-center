---
pillar: engineering
title: Taxonomy-First Quality Gates vs Free-Form Heuristics
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - taxonomy
  - quality-gates
  - testability
  - rules
  - heuristics
---

Explicit taxonomy rules for quality gates enable testable criteria, clear pass/fail decisions, and iteration without model retraining.

RoleNext's search-intent quality system uses taxonomy-driven heuristics (rules for detecting hallucinated skills or overly-specific requirements) rather than learned heuristics or free-form ML. This trades some expressiveness for measurability: rules are testable with canary cases, pass/fail is explicit and auditable, and iterating on quality doesn't require retraining models. The system can evolve independently as the product learns what quality means. Use taxonomy when you need clear criteria and fast iteration; use learned models when you have enough signal and need pattern recognition free-form rules can't capture.


## Related

- [[Resume Context Personalizes Suggestion Quality]]
