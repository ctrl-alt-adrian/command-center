---
pillar: engineering
title: Heuristic-First Quality Scoring Defers LLM to Edge Cases
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - quality-scoring
  - cost-efficiency
  - heuristics
  - llm
---

Quick heuristic rules catch common quality issues cheaply; reserve LLM refinement for edge cases to avoid per-keystroke inference costs.

In rolenext's search intent system, a two-tier quality check proved cost-effective: heuristics detect broad terms, missing skills, and hallucinated roles instantly, while LLM refinement kicks in for ambiguous intents. This pattern avoids the cost and latency of running inference on every keystroke, while still catching nuanced problems. Heuristic rules run synchronously; LLM is async and only triggers when the heuristic score falls below threshold. The 80/20 split meant most queries get instant feedback without backend overhead.
