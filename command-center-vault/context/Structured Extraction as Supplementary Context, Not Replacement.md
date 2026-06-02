---
pillar: context
title: Structured Extraction as Supplementary Context, Not Replacement
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - extraction
  - llm
  - prompt-engineering
  - rolenext
---

Structured JSON extracted from text improves LLM analysis only when paired with raw text; structured-only approaches produce systematically lower quality.

In RoleNext's staged LLM pipeline, Stage 3 (gap analysis) was initially given only structured profile data from Stage 1. Scores dropped from 45 to 22. Adding the full resume text back into the S3 prompt restored performance. The structured extraction is lossy—it misses skills, abbreviations, and contextual detail that the raw text preserves. Use structured data as a cheat sheet hint at the top of the prompt, but keep raw text as the primary input. This pattern likely applies to any domain where extraction quality matters less than validation against source material.


## Related

- [[Dynamic Domain Context Beats Maintained Taxonomies]]
- [[Feature-Flagged Variant Testing]]
