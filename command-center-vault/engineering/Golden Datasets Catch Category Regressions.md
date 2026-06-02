---
pillar: engineering
title: Golden Datasets Catch Category Regressions
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - job-categories
  - regression-detection
  - canary-testing
---

Canary test data across job families prevents silent regressions in occupation-aware rubrics.

The rolenext evaluation framework includes golden test datasets for each of the six job categories. An eval script runs these canaries in batch to catch if any rubric silently broke. Without cross-category tests, one domain could degrade while others stayed green. The canaries act as a contract: each occupation's rubric behavior is explicitly tested, making category-specific regressions visible.


## Related

- [[Registry Pattern Centralizes Scoring Rubrics]]
- [[Occupation-Aware Rubrics Beat Single Global Rules]]
