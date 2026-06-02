---
pillar: engineering
title: LLM Judge with Calibration for Content Quality
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - llm
  - quality-gates
  - evaluation
  - generated-content
aliases:
  - Judge calibration pattern
---

Use an LLM judge with calibration examples to evaluate generated content, enabling consistent quality gates.

rolenext's cover letter generation uses a three-phase pipeline: generate, judge (LLM), iterate. The judge is an LLM prompt that scores against relevance, personalization, and engagement. To calibrate it, the team created three golden examples with known scores and tuned the prompt until it matched human judgment. This ensures generated output meets a consistent quality bar. A calibration suite serves as the source of truth. The approach scales to any generated content: images, code, summaries. The key is isolating evaluation logic and calibrating before shipping.


## Related

- [[LLM-as-judge patterns]]
- [[Quality gates for generated content]]
- [[Testing generated output]]
