---
pillar: natural-language
title: Unify Concept Naming to Prevent Frontend Branching Logic
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - data-modeling
  - frontend-patterns
  - terminology
aliases:
  - enum consolidation
  - concept unification
---

When a concept has multiple names across contexts, consolidate into a single domain model that maps to occupation-aware output instead of branching frontend logic on string patterns.

RoleNext found that 'skill gaps' and 'opportunities' were used interchangeably across different contexts. Rather than building string-matching logic in the frontend to detect context and switch terminology, consolidate into a single enum that produces occupation-aware output. This prevents the frontend from containing fuzzy branching logic based on naming variations. The principle: push terminology decisions into the domain model, not scattered across UI code.


## Related

- [[Domain-Driven Design]]
- [[Single Responsibility Principle]]
