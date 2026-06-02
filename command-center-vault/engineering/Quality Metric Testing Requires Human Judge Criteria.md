---
pillar: engineering
title: Quality Metric Testing Requires Human Judge Criteria
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - quality
  - calibration
  - judgment
---

Automated pass/fail testing is insufficient for quality metrics. Design a judge criteria file to guide human calibration of edge cases.

Testing the search quality system required human judgment beyond simple pass/fail. The team created a judge criteria framework to guide scoring of edge cases at the phrase level. Automated tests can't distinguish between reasonable tradeoffs, so calibration needs explicit guidance on what counts as high-quality validation. This applies to any system where quality is context-dependent and automated metrics fall short.


## Related

- [[Testing patterns]]
- [[Quality evaluation]]
