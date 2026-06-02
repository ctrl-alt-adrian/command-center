---
pillar: engineering
title: Scores keyed by natural unique identifier
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - file-based-handoff
  - scoring
  - data-structures
---

Build a map of scores keyed by a natural unique identifier to attach them after a downstream computation returns.

RoleNext's retrieval scoring handler builds a map of scores keyed by job URL. After the LLM returns candidate fit scores, the handler looks up retrieval scores by URL and attaches them to results. URL is the natural unique key since jobs are already deduplicated by URL in expanded search. This pattern lets you compute scores in one phase, hold them in a structured map, and integrate them downstream without reshuffling the LLM output. Applies whenever results flow through multiple scoring or processing stages.


## Related

- [[Phase decomposition isolates signals]]
