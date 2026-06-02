---
pillar: engineering
title: Quality Thresholds Need Concrete Test Cases with Pass/Fail Rules
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - quality-gates
  - llm
---

Vague quality rules fail; concrete canary cases and explicit pass/fail criteria catch system gaps.

When testing LLM-based quality assessment, define concrete test cases that expose the boundary. For intent quality, a hallucinated-skills canary exposed gaps: early heuristics weren't catching false skills with plausible names. Adding explicit skill validation rules to the heuristic layer (cross-checking against known resume skills) fixed it. Vague thresholds like 'catch obviously bad intents' are useless; concrete canaries and clear pass/fail rules are not.


## Related

- [[Heuristic Layer Plus LLM Refinement Catches More Edge Cases]]
