---
pillar: engineering
title: Capturing Card Height Before Invisible State
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - drag-and-drop
  - measurement
  - ux
---

Measure the dragged card's height on drag start before it becomes invisible, then pass it to the placeholder.

In drag-and-drop UX with variable-height cards, capture the actual rendered height via `getBoundingClientRect().height` on the `dragstart` event, before the card collapses to `invisible h-0`. Store this in state and pass it to the placeholder div's height style. This ensures the placeholder matches the dragged card's dimensions exactly, regardless of varying content like salary ranges or resume names. If you wait until after the card becomes invisible, the height is 0 and the placeholder is a thin line.
