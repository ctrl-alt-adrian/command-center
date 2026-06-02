---
pillar: intuition
title: Boundary Bias Toward FAIL Stabilizes Borderline Verdicts
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - quality-gate
  - boundary-cases
  - verdict-rules
aliases:
  - fail bias
  - gating conservatism
---

Quality gates should bias borderline cases toward rejection to achieve verdict stability across runs.

The most common flip case in RoleNext's judges is a borderline score that oscillates between PASS and FAIL across consecutive runs. A resume with an ambiguous cross-field match might be judged as score 5.9 (FAIL) in one run and 6.1 (PASS) in the next. By explicitly coding 'when in doubt at the boundary, FAIL' into verdict rules, the same borderline case consistently rejects. This is the right default for a quality gate—the system should prove quality, not grant benefit of the doubt to ambiguous cases. The bias stabilizes the gate's behavior.


## Related

- [[Score Anchors Reduce LLM Judge Variance Without Fine-Tuning]]
