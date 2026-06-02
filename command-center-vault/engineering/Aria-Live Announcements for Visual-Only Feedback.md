---
pillar: engineering
title: Aria-Live Announcements for Visual-Only Feedback
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - wcag
  - aria
  - accessibility
  - screen-reader
aliases:
  - sr-only live region
  - aria-live polite
---

Use aria-live polite with an sr-only region to announce the outcome of visual-only actions like drag-drop. Screen reader users need to know the action succeeded.

Drag and drop is inherently visual feedback — the card moves on screen. But screen reader users don't see that. Add an sr-only region with aria-live='polite' that announces status changes: 'Moved {title} to {status}'. Fire the announcement on every drag completion. This fills the feedback gap: visual users see the card move, screen reader users hear the announcement. Both get confirmation. Tested in rolenext kanban (PR #80, 2026-04-13).


## Related

- [[Keyboard Path for DnD When Library Lacks Support]]
