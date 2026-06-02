---
pillar: engineering
title: Score Distribution Monitoring Detects Judge Drift
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - metric-monitoring
  - judge-eval
  - drift-detection
  - inflation-warnings
---

Watch for unexpected score creep (rising average, shrinking range) as an early warning sign of judge drift or prompt gaming.

If a judge's score distribution shifts over time, that's a signal the judge is drifting or being gamed. In RoleNext, the eval pipeline monitors min/max/average/spread per judge after each calibration run. A sudden jump in average scores, collapse of the range, or minimum rising triggers an inflation warning. This catches drift before it corrupts downstream decisions. The monitoring is cheap to add and provides visibility into whether optimization loops are actually improving the judge or just inflating its scores.


## Related

- [[Metric Drift Detection]]
- [[Calibration Signals]]
