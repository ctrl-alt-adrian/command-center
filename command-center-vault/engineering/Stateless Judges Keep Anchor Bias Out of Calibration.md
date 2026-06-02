---
pillar: engineering
title: Stateless Judges Keep Anchor Bias Out of Calibration
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - judge-architecture
  - state-management
  - calibration
aliases:
  - prompt-baked anchors
  - stateless evaluation
---

Bake rubric anchors directly into judge prompts rather than storing them in sidecar files, to prevent cross-example anchoring bias.

Each judge invocation in RoleNext is isolated (starts fresh with `claude -p`). If anchors were stored in a persistent sidecar JSON file, the system would reuse the same reference scores across examples, causing earlier judgments to anchor later ones (score 7 on Resume A pulls Resume B toward 7 even if Resume B deserves lower). By baking anchors directly into the prompt text, every invocation is self-contained. Calibration state (flip rates, score distributions) lives in the harness, not the judge. This separation keeps the judge a pure function and prevents prompt/state drift.


## Related

- [[Score Anchors Reduce LLM Judge Variance Without Fine-Tuning]]
