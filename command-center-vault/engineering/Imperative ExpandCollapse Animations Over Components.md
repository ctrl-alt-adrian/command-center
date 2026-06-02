---
pillar: engineering
title: Imperative Expand/Collapse Animations Over Components
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - animations
  - component-design
---

Extracting expand/collapse logic into a shared utility gives more control over easing and timing than component libraries.

Radix Collapsible and similar libraries provide good defaults but limit control over animation timing and easing curves. Extracting expand/collapse into a shared utility (toggleExpandable()) that imperatively manages element height and opacity gives full control over animation behavior. This is especially useful when the same animation needs consistency across different component types. Rolenext extracted this into src/lib/expandable.ts and called it from JobResultCard and JobListCard.
