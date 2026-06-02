---
pillar: engineering
title: Heuristic Layer Plus LLM Refinement Catches More Edge Cases
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - quality-gates
  - llm-integration
  - testing
---

Dual-layer quality checking (heuristics for speed, LLM for subtlety) outperforms either approach alone.

For search intent quality assessment, heuristics-only misses subtle problems (hallucinated skills that sound plausible), and LLM-only is slow and expensive. A hybrid works better: heuristics run first to catch obvious issues and filter quickly, then LLM refines on a smaller subset and catches what pattern matching missed. Quality test cases should probe both layers—canary cases like hallucinated skills exposed gaps in heuristics that LLM would catch but shouldn't have to.
