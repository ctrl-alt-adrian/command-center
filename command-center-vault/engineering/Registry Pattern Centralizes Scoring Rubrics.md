---
pillar: engineering
title: Registry Pattern Centralizes Scoring Rubrics
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - golang
  - patterns
  - configuration
  - maintainability
---

A single source of truth for scoring criteria prevents rubric drift across code changes.

To prevent occupation-aware rubrics from diverging via copy-paste, the rolenext team built a registry pattern in rubrics/registry.go. Each job family has one canonical rubric definition referenced everywhere. This eliminates silent drift where one category's rubric gets updated but others don't. Single source of truth for scoring rules per family prevents the maintenance hazard of keeping six related but independent rubrics in sync.


## Related

- [[Occupation-Aware Rubrics Beat Single Global Rules]]
- [[Golden Datasets Catch Category Regressions]]
