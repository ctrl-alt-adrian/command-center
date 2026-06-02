---
pillar: engineering
title: 'Defense in Depth: Frontend Check Plus Backend Validation'
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - validation
  - safety
  - editor
  - form-handling
aliases:
  - layered validation
  - belt and suspenders
---

Frontend emptiness check prevents sending empty content. Backend validator catches it independently in case the client lies or state diverges.

Tiptap editors with empty documents produce HTML like <p></p> or <p><br></p>. RoleNext added frontend isEmpty checks on both resume and cover letter editors to prevent sending, then added backend isHTMLEmpty() in UpdateJob and SaveCoverLetterEdits to strip tags, trim whitespace, and reject anyway. The frontend check improves UX (fail fast, stay in editor). The backend check is security and correctness: it doesn't trust the client and ensures garbage data never persists.


## Related

- [[Autosave on Blur Replaces Unsaved-Changes Prompts]]
