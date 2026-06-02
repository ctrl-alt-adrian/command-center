---
pillar: engineering
title: Imperative Array Construction for Spliced Elements in React
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - rendering
  - lists
---

Build React element arrays imperatively to insert elements at computed indices instead of using JSX .map().

When you need to insert an element at a computed position within a list (like a drag-and-drop placeholder), avoid JSX `.map()` patterns and instead build the element array imperatively with a loop. Iterate through the data and push normal elements, but splice in your computed element at the condition point. This pattern integrates cleanly with framer-motion's `AnimatePresence`. The spliced element mounts and unmounts naturally without needing manual positioning or z-index juggling.
