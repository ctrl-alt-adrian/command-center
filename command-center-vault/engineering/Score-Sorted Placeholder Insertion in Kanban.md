---
pillar: engineering
title: Score-Sorted Placeholder Insertion in Kanban
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - kanban
  - drag-and-drop
  - sorting
aliases:
  - insertion-point-calculation
---

Insert drag-drop placeholders at the correct sorted position by iterating through sorted items and splicing before the first item with lower sort value.

In a kanban with score-sorted cards, the drag-and-drop placeholder must appear at the exact position where the card will land when dropped. Calculate this by iterating through the sorted job list and inserting the placeholder before the first card with a lower `matchScore` than the dragged card. Skip the dragged card itself, which remains in the source column's array but is rendered invisible. If no lower-scoring card exists, append the placeholder at the end. This ensures the preview always matches the final sorted position.
