---
pillar: mapping
title: Three-Tier Confidence Ladder for Intent
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - intent
  - confidence
  - taxonomy
  - heuristics
  - search
aliases:
  - confidence model
  - intent classification
---

Use a three-tier confidence model to decide which intent analysis and UI hints to show: high returns heuristic suggestions immediately, medium adds an LLM refine cue, low suggests LLM refine only.

High confidence (exact canonical match, known broad term, or strong heuristic signal) returns immediately with curated suggestions. Medium confidence (token overlap of 50% or more) suggests heuristically and flags the query for LLM refinement. Low confidence (no heuristic signal) skips suggestions and marks the query for LLM refine only. This framework determines the information density and next-step clarity for users — high confidence is actionable now, medium and low delegate to an LLM. Appeared in RoleNext search intent work, April 2026.


## Related

- [[Skill Overlap Beats Adjacency in Title Ranking]]
