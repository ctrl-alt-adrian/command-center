---
pillar: free-lunch
title: Multi-Signal Intent Detection with Streaming
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - search
  - ux
  - streaming
  - ai
  - signals
aliases:
  - layered-signal-architecture
  - cheap-then-expensive-signals
---

Combine cheap signals (taxonomy, resume parsing) with expensive signals (LLM refinement) via streaming to make AI-guided features feel instant, not blocking.

Stacking multiple quality gates—fast heuristics first, then optional LLM refinement via streaming—gives AI features the feel of instant feedback without the latency cost. In RoleNext's search intent system, taxonomy classification and resume analysis run immediately on keystroke (debounced), giving users inline warnings in milliseconds. LLM refinement streams via Server-Sent Events as an opt-in card below, avoiding polling overhead. Users see quick wins fast and can dig deeper if they want. The pattern: cheap, deterministic signals buy time while expensive signals load in the background.


## Related

- [[SSE for LLM Streaming Over Polling]]
- [[Debounce Keystroke Triggers for API Load]]
