---
pillar: intuition
title: Use Test Cases to Calibrate Validation Thresholds
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - calibration
  - validation
  - testing
  - metrics
aliases:
  - Empirical Threshold Tuning
---

Confidence scores are arbitrary until calibrated against test cases; iterate thresholds until false positive rate meets target.

Heuristic confidence scores (how bad is this intent?) are meaningless until validated against real data. The search intent system built a judge test framework with clear pass, fail, and canary cases (known hallucinations). Iterating thresholds against these test cases until the false positive rate fell below 2% turned arbitrary scores into validated decision boundaries. Define what success means, measure it on known data, adjust thresholds to hit the target. Don't ship with guessed thresholds.


## Related

- [[Gate Expensive LLM Calls Behind Cheap Heuristics]]
