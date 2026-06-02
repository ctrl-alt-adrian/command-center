---
pillar: intuition
title: Vague Meta-Instructions Signal Generation Prompt Failure
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - generation
  - failure-modes
  - prompt-tuning
---

When a generation prompt produces instructions about how to answer rather than concrete answers, the prompt is not opinionated enough.

RoleNext's first interview generation eval (April 2026) produced meta-instructions instead of concrete content: 'Describe a time you handled a challenge' rather than 'Open with the clinical scenario and role, then walk through the protocol step-by-step, and close with measurable outcome.' Generic tips like 'use the STAR method' instead of company-specific guidance like 'MedStar values cura personalis -- weave in a specific example of how you personalized care beyond standard protocol.' This pattern signals the prompt is abstract enough that the LLM falls back to marketable but useless guidance. The fix requires shifting from rules to concrete examples embedded in the schema itself.


## Related

- [[Inline Schema Examples Steer LLM Away From Vagueness]]
