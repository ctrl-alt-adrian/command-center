---
pillar: engineering
title: Gap Calculation Separated from Aggregation for Explainability
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - skill-gaps
  - separation-of-concerns
  - architecture
  - explainability
---

Separating gap calculation from aggregation enables explainability and testability in complex scoring systems.

In RoleNext interview prep, skill gaps can be calculated accurately but users won't trust a score they can't understand. By separating the calculation phase (raw gap analysis) from the aggregation phase (ranking and filtering), the team could build detailed rationales explaining why each gap appears. This split also improved testability — each concern had its own surface area. The aggregation layer (skill_gap_aggregate.go) handles complex ranking logic while the calculation stays focused. When scoring systems must earn user trust, explainability often matters more than precision alone.


## Related

- [[User Trust Requires Explainability, Not Perfect Accuracy]]
- [[Treat API Specs as Contracts, Not Docs]]
