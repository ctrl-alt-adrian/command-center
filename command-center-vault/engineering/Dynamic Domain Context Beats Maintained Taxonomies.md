---
pillar: engineering
title: Dynamic Domain Context Beats Maintained Taxonomies
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pipeline
  - architecture
  - scaling
  - rolenext
---

Derive contextual labels from input data rather than routing via hand-maintained taxonomies; scales without ongoing taxonomy updates.

RoleNext initially considered hand-tuned prompts per occupation sector (tech, insurance, nursing, etc.), requiring ongoing category maintenance. Instead, Stage 1 of the pipeline dynamically generates domain context directly from the resume text. This label is metadata for display, not a routing key. The approach scales to any field from day one without taxonomy maintenance. Applied to job-seeker analysis, but the pattern generalizes: when you need to categorize or contextualize input, extract the label from the data itself rather than route through a pre-built taxonomy.


## Related

- [[Structured Extraction as Supplementary Context]]
- [[Staged LLM Analysis Pipeline]]
