---
pillar: intuition
title: Retry Amplification in Pipeline Automation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - retry
  - resilience
  - blast-radius
  - backpressure
---

Each retry layer multiplies the blast radius. One generation failure became 25+ Claude invocations through compounding retries.

Designing a robust pipeline is harder than it seems. The marketing pipeline had generation retries, slop-check retries, and hook-based diagnostic calls. When a single piece of content failed generation, it retriggered slop-check, which retriggered generation, which retriggered hooks, which spawned diagnostic Claude calls. The result: one failed candidate spawned 25+ API calls (6 platforms x multiple retry/hook layers). Each layer designed for robustness actually multiplied failure consequences. The insight: reduce retry depth aggressively. The content pipeline reduced MAX_SLOP_RETRIES from 10 to 3 because empirically, if writing patterns survive 3 rewrites with explicit feedback, more attempts won't help. Content needs human intervention at that threshold.


## Related

- [[Cascading Hook Failures in Pipeline Automation]]
- [[MAX_SLOP_RETRIES Calibration]]
