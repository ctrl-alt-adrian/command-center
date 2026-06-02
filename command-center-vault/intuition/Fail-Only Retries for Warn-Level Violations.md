---
pillar: intuition
title: Fail-Only Retries for Warn-Level Violations
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - gating
  - retry
  - severity
  - quality
---

In a two-tier violation system (fail vs warn), only fail-level violations should trigger retries. Warn-level violations pass through.

When classifying content violations as fail or warn, apply different retry logic. Fail-level violations should trigger regeneration. Warn-level violations should pass through without retry. Reasoning: certain warn-level words can be appropriate in context (e.g., 'robust' is legitimate in a technical resume). Retrying on warns increases LLM call count with minimal quality gain. In RoleNext, this reduced wasted API calls while still catching serious issues like repeated buzzwords or structural problems.
