---
pillar: agents
title: Staged LLM Analysis Pipeline
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pipeline
  - architecture
  - llm
  - rolenext
  - orchestration
---

Break monolithic LLM analysis into stages with constrained inputs and outputs; enables caching, independent optimization, and reduced cognitive load per stage.

RoleNext refactored a monolithic job-seeker analysis function (parse resume, parse JD, cross-check, score, recommend in one LLM call) into a 3-stage pipeline: Stage 1 (domain and resume extraction, cached per resume on upload), Stage 2 (JD extraction, cached per job at search time), Stage 3 (gap analysis using structured hints and raw text). Each stage has one focused job with constrained output. This reduces prompt complexity, enables targeted caching, and makes failures easier to debug. The pipeline is feature-flagged to coexist with v1 for A/B comparison.


## Related

- [[Structured Extraction as Supplementary Context]]
- [[Dynamic Domain Context Beats Maintained Taxonomies]]
- [[Feature-Flagged Variant Testing]]
