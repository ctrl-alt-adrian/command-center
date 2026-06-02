---
pillar: intuition
title: 'Animation Library Selection Trade-Off: CSS, Manual JS, or Framer-Motion'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - animations
  - library-selection
  - framework-choice
aliases:
  - animation-library-decision
---

CSS alone can't animate between separate DOM nodes; manual JS reimplements what libraries do with worse edge-case handling; framer-motion's layoutId is purpose-built for multi-node transforms.

When standardizing animations across RoleNext, the team evaluated three approaches for the sliding navbar indicator. CSS View Transitions API has zero bundle cost but lacks production-ready browser support (Firefox/Safari incomplete). Manual JS (getBoundingClientRect + requestAnimationFrame + CSS transform) works but reimplements framer-motion's cross-browser handling with worse ergonomics and edge cases. Framer-motion (33kb gzipped) is purpose-built for this problem — its layoutId connects animations between arbitrary DOM nodes and pays for itself when micro-animations are used elsewhere in the app. The decision hinges on whether you're shipping one micro-animation (CSS-only) or building a system (library). For RoleNext, a phased adoption of framer-motion across navbar, existing animations, and app-wide patterns justified the dependency cost.


## Related

- [[Animation Restraint Guardrails Prevent Scope Creep]]
- [[Phased Library Adoption Avoids Animation Sprawl]]
