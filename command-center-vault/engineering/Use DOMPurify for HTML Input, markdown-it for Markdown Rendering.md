---
pillar: engineering
title: Use DOMPurify for HTML Input, markdown-it for Markdown Rendering
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - security
  - xss
  - sanitization
  - owasp
aliases:
  - html-sanitization
  - user-input-safety
  - xss-prevention
---

Different tools for different input sources: DOMPurify for user-submitted HTML, markdown-it with html:false for Markdown.

Editor pages (CoverLetterEditorPage, ResumeEditorPage) accept user-generated HTML and Markdown. DOMPurify scrubs user HTML to remove scripts and malicious attributes, preserving formatting. Markdown is rendered with markdown-it and html: false flag, which strips any HTML tags in the markdown source and renders only the Markdown AST. This dual approach is OWASP-compliant and prevents XSS even if a user pastes malicious HTML. DOMPurify is heavier; markdown-it with html:false is faster for plain Markdown input. Choosing the right tool for the input type reduces bloat and keeps rendering predictable. The approach was codified in .claude/rules/react-style.md as a non-negotiable security gate.


## Related

- [[Validate Best Practices Against Industry Standards Before Codifying Rules]]
