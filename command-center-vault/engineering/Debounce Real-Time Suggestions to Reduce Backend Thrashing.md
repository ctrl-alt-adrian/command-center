---
pillar: engineering
title: Debounce Real-Time Suggestions to Reduce Backend Thrashing
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - debouncing
  - real-time
  - ux
  - backend-load
aliases:
  - Keystroke Debounce Pattern
---

Firing suggestions on every keystroke overloads the backend; debouncing reduces load 10x while keeping UX responsive.

The initial design for search intent suggestions fired an API call on every keystroke, causing excessive backend load. Adding debounce logic (wait for typing pause before firing) reduced backend traffic by 10x while keeping the UX snappy. The debounce window matters: too short and you're back to thrashing, too long and suggestions feel laggy. For this domain, 300–500ms felt right. Pattern applies to any real-time suggestion system.


## Related

- [[Stream LLM Reasoning Instead of Waiting for Full Response]]
