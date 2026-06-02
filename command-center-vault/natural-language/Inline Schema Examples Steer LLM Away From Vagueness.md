---
pillar: natural-language
title: Inline Schema Examples Steer LLM Away From Vagueness
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-tuning
  - json-schema
  - anti-slop
  - generation
---

Concrete GOOD/BAD examples embedded in JSON schema descriptions prevent vague LLM output more effectively than abstract rules.

When tuning the RoleNext interview generation prompt (April 2026), the first eval revealed answer_quality=5 and tips_quality=4: the LLM was producing vague meta-instructions like 'Describe a time you handled a challenge' instead of 'Open with the specific clinical scenario, then walk through the protocol step-by-step, and close with the measurable outcome.' Adding abstract rules didn't fix it; the breakthrough was embedding GOOD/BAD examples directly in the schema field descriptions. Instead of 'sampleAnswer: a framework for answering this question', use 'sampleAnswer: [description] BAD: [vague example]. GOOD: [concrete example]'. The LLM sees the example at the exact point where it generates that field. This aligns with the anti-slop principle that specific, opinionated prompts steer away from training median better than rules alone.


## Related

- [[Anti-Slop Principle]]
- [[Generation Prompt Patterns]]
