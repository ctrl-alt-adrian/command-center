---
pillar: engineering
title: Test Data Splitting Prevents Eval Overfitting
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - test-data
  - eval-overfitting
  - calibration
  - held-out-sets
---

Split test data into tuning (for calibration loops) and held-out (for final evaluation), preventing judges from adapting to evaluation data.

In RoleNext, test examples are split 60/40 tuning/held-out. Judges are optimized against tuning data; final results are only reported on held-out data. This prevents the judge from overfitting to the specific test cases and gives a clearer picture of real performance. Without splitting, each calibration loop lets the judge tune itself to the exact examples it will be scored on, inflating measured performance.


## Related

- [[Train/Test Separation]]
- [[Evaluation Hygiene]]
