---
pillar: engineering
title: Auto-trigger With Debounce Balances Responsiveness and Load
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - debounce
  - ux
  - backpressure
aliases:
  - Keystroke Debouncing
---

Auto-triggering suggestions on keystroke with debouncing reduces friction and prevents API thrashing.

Auto-triggering suggestions on every keystroke seems responsive but causes API queuing and stale results. A 300ms debounce window significantly improves perceived responsiveness by batching rapid keystrokes into a single API call. The alternative—an explicit 'refine' button—requires extra user action and reduces discovery. The trade-off: auto-trigger with debounce is better for friction, but only if debounce windows are coordinated between frontend and backend so the backend isn't evaluating stale queries.
