---
pillar: engineering
title: Rehydration as First-Class Export Concern
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - sessions
  - rehydration
  - exports
  - context-passing
aliases:
  - export-driven-by-rehydration
---

Export formats should be designed for rehydration (bootstrapping a fresh session) rather than narrative, because the two have opposing structural needs.

RoleNext's session export evolved from narrative-first (good for Obsidian docs: 'What was done → Decisions → Technical details') to rehydration-first ('Quick Start → Lineage → Working state → Next steps'). The original format worked for human review but was useless for a new Claude Code session, which needs actionable context structured for quick intake. This shift treats rehydration as a first-class concern, not an afterthought. Exports aren't just for documentation—they're bootstrap documents that let another session pick up work without re-reading a story. Structure them accordingly.


## Related

- [[Dual-Path Rehydration Tradeoffs]]
- [[Selective Inheritance in Session Chains]]
