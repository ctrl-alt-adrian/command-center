---
pillar: intuition
title: Keyboard Path for DnD When Library Lacks Support
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - accessibility
  - dnd
  - keyboard
  - wcag
aliases:
  - DnD keyboard fallback
  - accessible drag-drop without arrow keys
---

When your DnD library has no keyboard support, use the existing accessible alternative (select dropdown) as the keyboard path instead of reimplementing full arrow-key DnD or swapping libraries.

HTML5 Drag and Drop has zero keyboard support. Three options: (1) full arrow-key DnD (complex, reimplements what @dnd-kit does), (2) swap to @dnd-kit (major refactor), (3) annotate the existing select dropdown as the keyboard path. Chose option 3. Every card already has a select for status changes — functionally equivalent to drag-drop. Pair it with aria-roledescription to name the widget and aria-live announcements to signal success. This delivers WCAG AA compliance without over-engineering. Tested in rolenext kanban (PR #80, 2026-04-13).


## Related

- [[Aria-Live Announcements for Visual-Only Feedback]]
