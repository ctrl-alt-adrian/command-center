---
pillar: engineering
title: 'Dual-Path Rehydration: Resume vs Fresh'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - sessions
  - rehydration
  - context-passing
aliases:
  - resume-vs-fresh-start
---

Offer two rehydration paths: claude --resume for full conversation history (complete but heavy) and paste-to-rehydrate for distilled context (lightweight, clean start).

When a session ends, the next one needs context, but all of it isn't always best. RoleNext exports provide Option A (claude --resume <id>) which carries full conversation history, letting the new session pick up mid-thought. This is complete but accumulates context baggage. Option B is a rehydration prompt—a formatted block to paste as the first message—that distills only still-relevant context: working state, mental model, approach, blockers. New session starts lightweight and focused. Resume wins if continuation is direct; fresh rehydration wins if you need a context reset or are transitioning to a new contributor.


## Related

- [[Rehydration as First-Class Export Concern]]
- [[Selective Inheritance in Session Chains]]
