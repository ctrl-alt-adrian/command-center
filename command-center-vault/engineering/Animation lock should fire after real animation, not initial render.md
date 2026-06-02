---
pillar: engineering
title: Animation lock should fire after real animation, not initial render
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - animation
  - framer-motion
  - react
  - state
---

An AnimatedCounter with a hasAnimated guard that triggers on first mount will lock the counter at initial-render values instead of re-animating when data arrives.

The original AnimatedCounter set hasAnimated.current=true on the first intersection (isInView triggered) regardless of the target value. When data loaded and target changed from 0 to a real number, the check saw hasAnimated=true and skipped animation, just setting the display directly. The 'Skills to Learn' metric card would freeze at 0 forever. Fix: only set hasAnimated=true after an animation with a real target (target > 0). This way, initial render with target=0 (loading state) doesn't lock the counter. When real data arrives, it animates normally. The guard exists to prevent re-animation on every render—but the gate timing matters.
