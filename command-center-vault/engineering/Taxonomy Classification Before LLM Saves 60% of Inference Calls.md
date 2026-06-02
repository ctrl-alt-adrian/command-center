---
pillar: engineering
title: Taxonomy Classification Before LLM Saves 60% of Inference Calls
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gating
  - cost-optimization
  - inference
  - hybrid-systems
aliases:
  - rules-before-ai
---

Fast deterministic heuristics catch majority of problems before expensive LLM calls, conserving budget and latency.

In the search intent quality system, we classified queries with deterministic rules (hallucinated skills, unclear intent, skill overreach) before calling LLM. This caught roughly 60% of problems without inference. The pattern: hybrid gating where deterministic rules handle high-confidence cases and LLM escalates edge cases only. Useful when building systems that need both speed and accuracy but can't afford to LLM-first.


## Related

- [[Separate Refinement Endpoint]]
