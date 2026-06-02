---
pillar: intuition
title: Hard Blocks Over Soft Warnings
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - enforcement
  - decision-making
  - gates
---

When a rule can be checked and blocked, block it—soft warnings get ignored.

Initial impulse was to emit warnings for violations (file exceeding 400 lines, debug statements, etc.). Experience showed this doesn't work—soft warnings are routinely ignored. If a check fires, the violation is real and must be resolved before proceeding. Hard blocks force the issue rather than hoping for compliance. When you have the ability to block, use it.


## Related

- [[Mechanical Enforcement for Forgotten Code Quality Rules]]
