---
pillar: engineering
title: Resume Context Gates Hallucinated Skills
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - llm-validation
  - hallucination
  - ground-truth
  - search-intent
aliases:
  - Structured Data Validates Unstructured LLM Output
---

Resume skill list catches hallucinated skills that LLM invents, serving as ground-truth validation gate.

In the RoleNext search intent quality system, the LLM suggests job-relevant skills that don't exist in the user's resume about 5% of the time. Validating refined intents against the resume skill list catches all hallucinations. This pattern generalizes: structured contextual data (resume, schema, known-good set) serves as a validation gate for unstructured LLM outputs. No algorithmic shortcut works; the check is mandatory and row-level. Apply whenever LLM output claims to add or refine facts about a bounded domain.


## Related

- [[Gate Expensive LLM Calls Behind Cheap Heuristics]]
- [[Data-Driven Threshold Calibration]]
