---
pillar: intuition
title: Smaller Models Validate Prompt Structure, Not Quality
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - model-selection
  - testing-strategy
  - cost-optimization
aliases:
  - use-8b-for-structure
  - cheap-validation-bounds
---

Smaller, faster models can verify that a prompt parses and structures correctly, but should not be used to evaluate output quality.

When the 70b model hit rate limits, the instinct was to test structural prompt changes with an 8b model. The 8b confirmed that STAR frameworks and varied tip suggestions were being parsed correctly. But for quality evaluation, the 8b hallucinated (recommending 'DevOps engineer' for nursing candidates) and got basic facts wrong (11 questions instead of 10). Scores from the 8b run (3/10) were useless. Key distinction: small models are cheap structural proxies for validating parse logic. For judging output quality, use the right-sized model for the task.


## Related

- [[Model Oscillation Between Scripted and Skeleton Outputs]]
