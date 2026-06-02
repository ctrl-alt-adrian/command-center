---
pillar: harness
title: Enforce Config at the Harness Level, Not in CLAUDE.md
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - settings.json
  - determinism
  - enforcement
---

Move behavioral requirements (like attribution suppression) to settings.json so the harness enforces them, reducing reliance on Claude remembering instructions.

Started with 'no Claude attribution' as a CLAUDE.md rule, but that relies on Claude reading and remembering it every time. Moved it to settings.json (`attribution.commit: ""`) so the harness itself rejects forbidden patterns. Use settings.json when a rule must never slip due to forgetfulness; use CLAUDE.md when context and reasoning matter.


## Related

- [[Scoped Rules with Globs Load Only When Relevant]]
