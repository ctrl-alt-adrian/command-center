---
pillar: engineering
title: Empty State Z-fighting with AnimatePresence
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - framer-motion
  - animation
  - edge-cases
---

Coordinating empty state exit with placeholder entrance in AnimatePresence causes z-fighting; keep empty state as a plain div.

When a drag-and-drop placeholder appears over an empty state message, attempting to coordinate both elements' animations within the same `AnimatePresence` wrapper causes z-fighting where the empty state div renders under, then on top, then under again. The solution is to render the empty state outside `AnimatePresence` as a plain conditional `div` without any exit animation. Let it disappear instantly when items exist. This simplifies the animation scope to just the placeholder and avoids visual glitches.
