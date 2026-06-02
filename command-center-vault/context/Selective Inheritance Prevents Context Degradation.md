---
pillar: context
title: Selective Inheritance Prevents Context Degradation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - sessions
  - lineage
  - context-passing
  - inheritance
aliases:
  - session-lineage
  - forward-context-selectively
---

Track session ancestry and inherit only still-relevant context from parents, not everything, to maintain clarity across session chains.

RoleNext exports track session lineage: each export records its parent and inherits context from it. But indiscriminate copying degrades context—stale working state, irrelevant blockers, superseded decisions accumulate. Instead, each export carries forward only what still matters, with a chain summary explaining what changed. This requires deliberation (is this context load-bearing?) but pays off when a project spans many sessions. Without lineage, context is lost. With blind copying, it rots. Selective inheritance—tracked and explicit—gives both continuity and clarity.


## Related

- [[Rehydration as First-Class Export Concern]]
- [[Dual-Path Rehydration Tradeoffs]]
