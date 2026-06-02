---
pillar: engineering
title: Organize Micro-Animation Patterns by Interaction Type, Not Page
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - micro-animations
  - design-patterns
  - reusability
aliases:
  - animation-pattern-organization
---

Grouping micro-animations by shared interaction (button press, card reveal, list entry) across pages prevents duplicate implementations and makes guardrails enforceable.

When codifying Phase 3 micro-animation patterns, RoleNext organized by reusable interaction type (button press, card reveal, list entry, modal open) rather than by page or component. This prevents the same animation from being hand-rolled differently in three places, makes it easier to apply performance guardrails consistently, and creates a reference set that future PRs can copy. A developer adding a new button press animation sees the established pattern and follows it; if patterns are scattered per-page, they're invisible and reinvented each time.


## Related

- [[Animation Restraint Guardrails Prevent Scope Creep]]
- [[Phased Library Adoption Avoids Animation Sprawl]]
