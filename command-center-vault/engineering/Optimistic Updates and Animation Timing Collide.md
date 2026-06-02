---
pillar: engineering
title: Optimistic Updates and Animation Timing Collide
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - animation
  - timing
  - optimistic-updates
  - react
aliases:
  - placeholder-exit-timing
---

When optimistic mutations update state synchronously, exit animations can overlap with newly-rendered content in the same render frame.

In RoleNext's kanban, the mutation's onMutate callback runs synchronous optimistic updates — the card immediately appears in the target column via cache update. But the placeholder had a 150ms exit animation via framer-motion's AnimatePresence. This meant the same React render showed both the newly-arrived card and a fading placeholder, creating visual overlap. Fix: make placeholder exit instant (transition: { duration: 0 }) while keeping entrance animations smooth (150ms ease-out). The entrance animation for the new placeholder in the next column still has time to animate in. This pattern applies anywhere optimistic updates race with exit animations.


## Related

- [[Four Drag-and-Drop Polish Patterns for Premium Feel]]
