---
pillar: engineering
title: Coordinated Animation Lifecycles Prevent Drag-Drop Flicker
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - animations
  - drag-and-drop
  - ux
  - framer-motion
aliases:
  - animation-choreography
  - coordinated-animation-lifecycles
---

Timing empty state exit with placeholder entrance requires coordinated animation lifecycles, not simple delay choreography.

When implementing drag-and-drop with animated placeholders, timing the empty state disappearance matters more than the individual animations. If the empty state exits too early, the column flickers; if too late, both empty state and placeholder appear simultaneously. Simple delay-based choreography fails. The solution requires binding the animations to each other's lifecycle so they truly coordinate—when framer-motion's placeholder entrance triggers, the empty state must be guaranteed to already be gone. This insight emerged from RoleNext's kanban redesign (April 2026), which replaced a static drag-over indicator with an animated positional placeholder.


## Related

- [[Positional Placeholders Provide Clearer Drop Feedback Than Ring Indicators]]
