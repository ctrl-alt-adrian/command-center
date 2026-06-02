---
pillar: engineering
title: Confusion Matrix Reveals Judge Behavior Patterns
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - calibration
  - llm-judge
  - diagnostics
  - metrics
aliases:
  - judge fingerprint
  - behavior signature
---

TP/TN/FP/FN breakdown reveals whether a judge rubber-stamps, is too strict, or is properly calibrated.

A single accuracy number hides behavior. A confusion matrix (TP, TN, FP, FN, precision, recall, specificity, F1) reveals the judge's actual strategy. High accuracy but low precision means rubber-stamping. High accuracy but low recall means too strict. Both precision and recall near 1.0 means properly calibrated. FP rate rising over time signals the judge drifting toward lenience. Specificity collapse signals the judge starting to approve everything. Adding confusion-matrix analysis to the calibration harness catches these patterns early.


## Related

- [[Sequential Gate Design Catches Failures at Different Speeds]]
- [[Block-and-Diagnose Over Auto-Remediation]]
