---
pillar: natural-language
title: Export Structure Should Match Downstream Use Case
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - exports
  - document-design
  - structure
aliases:
  - design-for-the-reader
---

Export format structure should be driven by who reads it and what they do next, not by the order things happened.

RoleNext's session export started narrative: 'Summary → What was done → Decisions → Technical details → Open items.' This order works for human review in Obsidian but fails for a new Claude session starting work. A fresh session needs actionable context immediately: 'Quick Start → Lineage → Working state → Next steps.' Same content, opposite order. The lesson: don't structure exports around the session's timeline. Structure them around what the downstream reader does first. For human review, narrative wins. For session rehydration, actionability wins.


## Related

- [[Rehydration as First-Class Export Concern]]
