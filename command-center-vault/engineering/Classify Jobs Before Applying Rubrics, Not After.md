---
pillar: engineering
title: Classify Jobs Before Applying Rubrics, Not After
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pipeline-order
  - job-matching
  - architecture
  - clarity
---

Explicitly classify job family upfront, then apply the matching rubric, rather than trying to auto-select downstream.

The rolenext pipeline classifies incoming jobs into families first, then applies the corresponding occupation-aware rubric. This upfront classification is simpler and more auditable than heuristics that try to guess which rubric applies downstream. Explicit decisions are easier to debug when a job gets the wrong rubric. The role-family classifier gates the entire rubric selection logic.


## Related

- [[Pre-Filter Jobs Before Expensive LLM Analysis]]
- [[Occupation-Aware Rubrics Beat Single Global Rules]]
