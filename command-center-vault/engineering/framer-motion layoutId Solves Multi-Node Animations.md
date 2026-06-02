---
pillar: engineering
title: framer-motion layoutId Solves Multi-Node Animations
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - framer-motion
  - animations
  - layoutId
aliases:
  - layoutid-pattern
---

framer-motion's layoutId primitive animates a single element's position and size as it moves between separate DOM nodes without manual measuring.

RoleNext's navbar indicator slides between nav links as the user hovers or navigates. The indicator (background element) and nav links are separate DOM nodes, so pure CSS can't animate between them. framer-motion's layoutId solves this: wrap the indicator in a motion.div with layoutId='nav-indicator', assign the same layoutId to a hidden layout component at each nav link, and framer-motion automatically animates the background element's position and size as the layoutId target changes. This avoids manual getBoundingClientRect calculations, RAF loops, and the edge cases (scroll offset, relative positioning) that come with imperative animation. The result is 20 lines of React vs. 50 plus lines of hand-rolled JS.


## Related

- [[Animation Library Selection Trade-Off: CSS, Manual JS, or Framer-Motion]]
