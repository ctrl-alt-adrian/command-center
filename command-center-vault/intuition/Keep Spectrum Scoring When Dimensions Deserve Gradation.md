---
pillar: intuition
title: Keep Spectrum Scoring When Dimensions Deserve Gradation
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - scoring-design
  - dimensionality
  - rubric-design
aliases:
  - 0-10 vs binary
  - spectrum vs categorical
---

Use continuous scoring (0-10) when a dimension has meaningful gradations; reserve binary (PASS/FAIL) for discrete items.

RoleNext has 8 judges with different scoring scales. Gap analysis (matching skills to role requirements) uses binary categorical scoring because skills are discrete items—either a candidate lists them or doesn't. But match quality, tone, ATS optimization use 0-10 scoring because the dimensions are genuinely spectral. Professional tone ranges from corporate-formal to too casual. Forcing everything binary would lose signal. The variance problem isn't the scale—it's the lack of reference points. Adding score anchors to a 0-10 scale gives the LLM fixed examples to calibrate to without surrendering granularity.


## Related

- [[Score Anchors Reduce LLM Judge Variance Without Fine-Tuning]]
