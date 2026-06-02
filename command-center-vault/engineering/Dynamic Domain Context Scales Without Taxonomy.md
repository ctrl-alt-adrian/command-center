---
pillar: engineering
title: Dynamic Domain Context Scales Without Taxonomy
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - extraction
  - scaling
  - resume
  - architecture
aliases:
  - domain inference
---

Extract domain context from the resume itself instead of maintaining a formal occupation taxonomy.

S1 (resume extraction) generates domain context dynamically from the resume text, not from a predefined enum of occupation groups. This means the system scales to any sector without adding new taxonomy entries. A machinist, consultant, nurse, and data analyst each get domain context extracted from their own resume background. Simpler to maintain and more expressive than trying to fit users into buckets.


## Related

- [[Three-Stage Pipeline for Multi-Aspect Reasoning]]
