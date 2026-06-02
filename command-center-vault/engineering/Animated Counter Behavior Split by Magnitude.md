---
pillar: engineering
title: Animated Counter Behavior Split by Magnitude
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - animation
  - ui-patterns
  - timing
---

Small number counters need stepped animation frames to be visible; large numbers benefit from smooth RAF-based sweeps.

When animating numbers in UI, the frame rate determines perception. Small targets (5-20) animated with smooth RAF sweep tick through all frames too fast, making the animation feel jarring or invisible. Split the implementation: for target <= 20, use setInterval with even spacing so each increment is a distinct frame; for larger numbers, use cubic ease-out RAF for a smooth sweep. Rolenext used this for animated counters on landing page and dashboard.
