---
pillar: engineering
title: AnimatedCounter Loop Edge Case
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - animations
  - edge-cases
  - react
---

Increment-before-check pattern displays 1 instead of 0 for target=0.

The AnimatedCounter component animating to target=0 displayed 1 before clearing. The loop branch handling target <= 20 increments i before checking if i >= target. When target is 0, i increments to 1, setCount(1) fires, then exits. Fix: early return for target === 0 before animation branches. Surgical solution that doesn't change animation timing for other values.
