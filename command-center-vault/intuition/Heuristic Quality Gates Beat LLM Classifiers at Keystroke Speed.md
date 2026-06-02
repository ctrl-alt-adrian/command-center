---
pillar: intuition
title: Heuristic Quality Gates Beat LLM Classifiers at Keystroke Speed
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - heuristics
  - llm
  - latency
  - cost
  - performance
aliases:
  - Rule-Based Scoring vs ML
---

For real-time keystroke-level operations, domain-specific heuristics outperform LLM classifiers on latency, cost, and predictability.

The search intent quality system uses rule-based scoring instead of an LLM classifier, even though LLM could theoretically be more flexible. At keystroke scale (every few hundred milliseconds), LLM latency and cost become prohibitive. Heuristics—domain-specific rules like 'validate skills against resume profile'—are deterministic, instant, and scale linearly. This isn't a general principle; it's specific to the keystroke-level operating point. When the operating point changes (e.g., batch analysis, lower frequency), the tradeoff shifts.
