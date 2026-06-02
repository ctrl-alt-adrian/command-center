---
pillar: engineering
title: Salary Period Inference From Job Description
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - salary
  - data-inference
  - fallback-heuristics
---

When salary period is missing from structured data, scan the job description to infer hourly vs annual compensation.

Job APIs sometimes omit salary period (hourly vs annual) despite providing salary ranges. Scan the description for signals: hourly indicators include '/hr', 'per hour', and dollar-per-hour notation; annual indicators include 'annual', '/yr', 'per year', and salary magnitudes above ~50k. This heuristic provides useful inference when the period field is empty, avoiding ambiguity and reducing need for user input.


## Related

- [[Trust Source Data Over Custom Enrichment]]
