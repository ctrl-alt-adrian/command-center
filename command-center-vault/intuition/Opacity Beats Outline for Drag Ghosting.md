---
pillar: intuition
title: Opacity Beats Outline for Drag Ghosting
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - drag-and-drop
  - styling
  - ux
---

When showing a dragged card's source location, reduced opacity (40%) is more readable and feels more intentional than dashed-border outlines.

Showing users where a dragged card originated requires visual clarity. Dashed borders (like the kanban empty state) read as "incomplete" rather than "in motion." In RoleNext, 40% opacity with pointer-events-none signals that the card is still there but inactive — clearly muted without disappearing entirely. Readers can still parse the card's content, and the effect feels like the card is "picked up" rather than deleted.


## Related

- [[Four Drag-and-Drop Polish Patterns for Premium Feel]]
