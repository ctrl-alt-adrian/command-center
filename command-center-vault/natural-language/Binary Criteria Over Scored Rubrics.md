---
pillar: natural-language
title: Binary Criteria Over Scored Rubrics
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-design
  - eval-pipeline
  - judgment
  - actionability
aliases:
  - yes-no-beats-scores
---

Binary yes/no questions produce actionable signal for prompt tuning; scored rubrics (0-10) yield soft averages that hide what to fix.

When building an eval pipeline, yes/no criteria map directly to specific prompt fixes. A scored rubric tells you 'average quality is 6/10 — good job.' A binary question like 'Is this skill actually on the resume?' tells you 'missed 5 times — rewrite the search logic.' Categorical labels (COMPLETE/MINOR_GAPS/MAJOR_GAPS) let you bucket failures by kind. Each failure_reasons entry should correspond to one specific change in the upstream prompt. This was the core insight from the RoleNext gap-analysis evaluator (2026-03-31): shifted from a 6-dimension scored rubric to binary + categorical verdicts, and the feedback became immediately actionable.


## Related

- [[Steering Over Constraining]]
- [[Eval Pipeline Design]]
