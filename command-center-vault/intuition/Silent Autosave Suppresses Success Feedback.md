---
pillar: intuition
title: Silent Autosave Suppresses Success Feedback
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - autosave
  - toast
  - ux
aliases:
  - invisible success
  - error-only feedback
---

Autosave should be invisible. Show success toasts for manual save, suppress them for blur-triggered saves, but always show errors.

A success toast on every blur is noise. Manual Save buttons signal intentional action and warrant feedback. Autosave is background work that should go unnoticed on success. Implementation: saveResume(options?: { silent?: boolean }) where blur calls with { silent: true } and the button calls without args. Error toasts fire regardless of mode because users need to know something broke.


## Related

- [[Autosave on Blur Replaces Unsaved-Changes Prompts]]
