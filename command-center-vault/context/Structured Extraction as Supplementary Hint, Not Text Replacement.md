---
pillar: context
title: Structured Extraction as Supplementary Hint, Not Text Replacement
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-engineering
  - structure
  - extraction
  - reasoning
aliases:
  - structured context
---

Structured data is a cheat sheet for the model, not a replacement for raw text in reasoning.

When solving multi-text problems (comparing resume to job description, finding gaps), structured extraction seems like the right solution. RoleNext tried passing only structured resume and JD data to S3 (gap analysis). Scores dropped to 12-22. The fix: include the full resume text and full JD text, but prepend the structured data as a concise cheat sheet. Scores jumped to 58-88. The model reasons better with raw text; structure just provides a map. This scales to any extraction problem: parse your input into structured form, but use it to enhance the original prompt, not replace it.


## Related

- [[Three-Stage Pipeline for Multi-Aspect Reasoning]]
