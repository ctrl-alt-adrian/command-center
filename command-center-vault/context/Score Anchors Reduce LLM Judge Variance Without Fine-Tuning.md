---
pillar: context
title: Score Anchors Reduce LLM Judge Variance Without Fine-Tuning
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - llm-judge
  - determinism
  - prompt-engineering
  - rubric-anchoring
aliases:
  - LLM judge determinism
  - rubric anchoring
---

Explicit score band definitions, verdict decision rules, and categorical anchors in LLM prompts reduce output variance across runs without requiring model fine-tuning.

RoleNext's judging pipeline uses 8 LLM judges to evaluate resumes, cover letters, and interview responses. Early runs showed verdicts oscillating across invocations (resume A scores 7 one run, 6 the next). Rather than retrain or adjust temperature, we added concrete anchors to the prompts: score bands (e.g., '7-8: professional tone, clear structure, minor typos'), verdict decision rules ('when in doubt at boundary, FAIL'), and categorical anchors for discrete dimensions. After anchoring all 8 judges, calibration confirmed 100% accuracy and 0% flip rate. The pattern is portable—any AI grading system (hiring, peer review, content moderation) can use similar anchoring to stabilize verdicts.


## Related

- [[Stateless Judges Keep Anchor Bias Out of Calibration]]
- [[Boundary Bias Toward FAIL Stabilizes Borderline Verdicts]]
