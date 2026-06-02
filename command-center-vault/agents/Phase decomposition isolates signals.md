---
pillar: agents
title: Phase decomposition isolates signals
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scoring
  - orchestration
  - phase-design
  - robustness
---

Decompose a scoring system into phases: a deterministic heuristic phase filters obvious garbage, then a learned/LLM phase handles nuanced scoring on pre-filtered inputs.

RoleNext's explainable scoring system filters results through retrieval scoring (deterministic, 3 signals, ~90% garbage capture) before candidate-fit analysis (LLM-driven, 4 pillars). The heuristic phase rejects cross-domain noise that the LLM would otherwise waste reasoning on. This design reduces downstream brittleness because the LLM's inputs are pre-filtered; it focuses on nuanced fit assessment rather than obvious nonsense. General pattern: fast and deterministic first to filter, then slow and learned to refine. Applies to any two-stage system where you have both rules-based and model-based scoring.


## Related

- [[Heuristic Filtering Gate Before Expensive LLM Work]]
- [[LLM returns raw backend computes]]
