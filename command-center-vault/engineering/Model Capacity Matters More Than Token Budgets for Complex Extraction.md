---
pillar: engineering
title: Model Capacity Matters More Than Token Budgets for Complex Extraction
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - llm
  - extraction
  - rolenext
  - model-selection
---

Lightweight models truncate JSON mid-response on complex inputs even with increased max_tokens; upgrade to larger model capacity rather than adjusting token limits.

In RoleNext's Stage 2 (JD requirements extraction), the lightweight model (gpt-oss-20b) was producing incomplete JSON for complex job descriptions. Even with 1024 max_tokens, output truncated mid-structure. Increasing the token limit did not help. Switching to the default model (gpt-oss-120b) with 2048 max_tokens resolved it. The token budget is a ceiling, not a determinant of completion; model capacity determines whether the model can produce the full response within that budget.


## Related

- [[Structured Extraction as Supplementary Context]]
