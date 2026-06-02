---
pillar: engineering
title: Animation Restraint Guardrails Prevent Scope Creep
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - animations
  - performance
  - guardrails
  - scope-creep
aliases:
  - animation-performance-rules
---

Explicit constraints on animation duration, properties, and triggers prevent a gradual slide into animation debt and UX brittleness.

RoleNext's framer-motion adoption included explicit guardrails: 200ms duration ceiling, GPU-only properties (transform and opacity only), no simultaneous animations, no animation on repeat interactions, and reduced-motion guards on everything. Without these rules, teams drift toward longer tweens, color transitions, text effects, and over-animated repeat interactions that degrade performance or distract from content. The guardrails were paired with a 'What NOT to animate' list: no text animation, no form input effects, no infinite loops on interactive elements, no scroll-linked transforms, no color transitions on data changes. The principle: without micro-animations there's a sense of lost presence, but they should never degrade performance or take the spotlight. Measure before adding. If a page feels responsive without a pattern, don't add it.


## Related

- [[Animation Library Selection Trade-Off: CSS, Manual JS, or Framer-Motion]]
- [[Phased Library Adoption Avoids Animation Sprawl]]
