---
pillar: engineering
title: Phased Library Adoption Avoids Animation Sprawl
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - library-adoption
  - migrations
  - phases
  - strategy
aliases:
  - incremental-library-migration
---

Three discrete phases (immediate, incremental, systematic) replace scattered hand-rolled animations while avoiding big-bang rewrites and scope creep.

Instead of migrating all animations to framer-motion at once, RoleNext adopted a phased strategy. Phase 1 (immediate): navbar micro-animations using layoutId for the sliding indicator and hover effects. Phase 2 (incremental): migrate existing hand-rolled animations (IntersectionObserver fades, RAF-driven counters, imperative DOM toggles) to framer-motion variants. Phase 3 (systematic): codify app-wide micro-animation patterns (button press, card reveal, list entry) with performance and restraint guardrails. This approach lets the team ship value quickly, build confidence with the library, then establish patterns without the pressure of a migration. It also prevents the temptation to 'just add one more animation' that turns into scattered implementations across the codebase.


## Related

- [[Animation Restraint Guardrails Prevent Scope Creep]]
- [[Animation Library Selection Trade-Off: CSS, Manual JS, or Framer-Motion]]
