---
pillar: engineering
title: Directional Animation via Index Comparison
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - kanban
  - drag-and-drop
  - animation
  - framer-motion
aliases:
  - lane-direction-tracking
---

Track the previous drag-over lane and compare indices to compute drag direction, enabling directional slide-in animations.

To animate a drag-and-drop placeholder sliding through lanes directionally, maintain a ref to the previous drag-over lane and compare its index against the current lane's index when the drag status changes. Moving to a higher-index lane sets direction to 'right' and initializes the placeholder's `initialX` to -30%, so it slides in from the left. Moving to a lower-index lane sets it to 'left' with `initialX` of +30%, sliding from the right. On first hover with no previous lane, use a neutral scale-in animation instead of directional slide. This gives users immediate visual feedback about drag direction.
