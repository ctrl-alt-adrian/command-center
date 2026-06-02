---
pillar: harness
title: Effort-Nudge Hook for /effort max Reminder
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - effort
  - hooks
  - ux
---

A keyword-classifier hook surfaces /effort max reminder when planning/debugging prompts are detected.

Added a UserPromptSubmit hook that detects planning/debugging keywords in incoming prompts and reminds the user to enable /effort max mode. Since effortLevel cannot be set programmatically, the hook provides a nudge at the moment it matters most. This ensures the user is aware that plan-grade reasoning is available for non-trivial tasks.


## Related

- [[Effort Modes]]
- [[Hooks]]
- [[UX Signals]]
