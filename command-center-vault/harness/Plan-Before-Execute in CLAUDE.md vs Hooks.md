---
pillar: harness
title: Plan-Before-Execute in CLAUDE.md vs Hooks
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - infrastructure
  - cost-optimization
  - claude-code
---

Behavioral patterns belong in system prompt, not UserPromptSubmit hooks, because hooks pay a per-turn token tax.

This session migrated the plan-before-execute protocol from a UserPromptSubmit hook into ~/.claude/CLAUDE.md after discovering that hooks add token overhead every turn even when not actively planning. System-prompt rules are checked once at session start and carry no cost. Reserve hooks for one-shot or conditional behaviors (env-based toggles, OS-specific setup); move stateless behavioral patterns into CLAUDE.md. The cost difference makes this a meaningful infrastructure decision for recurring session behaviors.


## Related

- [[Effort Modes]]
- [[UserPromptSubmit Hooks]]
