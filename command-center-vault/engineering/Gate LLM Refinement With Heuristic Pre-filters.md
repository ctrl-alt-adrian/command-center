---
pillar: engineering
title: Gate LLM Refinement With Heuristic Pre-filters
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - llm
  - gates
  - cost-optimization
  - quality-control
aliases:
  - Heuristic Pre-filtering
  - Two-tier Refinement
---

Use cheap rule-based heuristics to gate expensive LLM operations, reducing both hallucinations and API costs.

When refining search intents with LLM, don't send every query for LLM processing. Instead, apply heuristic scoring upstream—simple rules based on query structure, resume context, and intent confidence. Only high-confidence queries proceed to LLM refinement. This approach simultaneously reduces hallucination risk (bad queries never reach the LLM) and cuts API costs (most queries are filtered out). The two-tier system (heuristics + LLM) beats LLM-only because it separates concerns: heuristics handle the easy cases and validate intent quality, LLM handles refinement for queries that passed the gate.


## Related

- [[Resume Context as Suggestion Amplifier]]
