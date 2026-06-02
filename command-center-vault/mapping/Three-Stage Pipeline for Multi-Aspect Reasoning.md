---
pillar: mapping
title: Three-Stage Pipeline for Multi-Aspect Reasoning
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pipeline
  - llm
  - staging
  - architecture
aliases:
  - staged reasoning
---

Break monolithic multi-step prompts into stages: cached extraction, per-item processing, and reasoning.

RoleNext's job-fit analysis started as one prompt doing six things at once: parse resume, parse job description, cross-check skills, score match, explain gaps, recommend optimizations. Results were inconsistent. The fix: three-stage pipeline. S1 (resume extraction) runs once on upload and is cached. S2 (JD extraction) runs per job. S3 (gap analysis) runs per job with outputs from S1 and S2. Each stage solves one problem. Scores improved from 12-45 (inconsistent) to 58-88 (consistent) for matching jobs. The key: don't try to do your reasoning in one pass.


## Related

- [[Structured Extraction as Supplementary Hint]]
