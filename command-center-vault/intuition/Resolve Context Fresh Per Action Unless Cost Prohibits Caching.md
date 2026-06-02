---
pillar: intuition
title: Resolve Context Fresh Per Action Unless Cost Prohibits Caching
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - state
  - freshness
  - tradeoffs
---

Re-derive context from the source record on each action instead of caching it, unless computation cost is prohibitive.

The candidate's sector is resolved fresh from the resume's domain_context on each question generation, rather than cached on the resume record. Caching would require a new column and migration. The tradeoff: regenerating for the same job may produce a different specialty category if the resume changes. This is acceptable because the specialty category is metadata, not structural. It guides the LLM but doesn't lock the data model. Reserve caching for high-cost operations; freshness and simplicity win otherwise.
