---
pillar: engineering
title: Markdown-It + HTML Passthrough for LLM-to-Editor Pipeline
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - markdown
  - tiptap
  - llm-integration
  - editor
aliases:
  - LLM markdown handling
  - markdown-to-editor conversion
---

Use markdown-it with html:true to convert LLM markdown output to HTML, then pass to TipTap editor setContent(). Backend LLM prompt should request markdown format explicitly.

When an LLM generates markdown (headings, bold, lists) and you need to render it in a TipTap editor, iteration shows: custom parsers are fragile, tiptap-markdown extension only handles clipboard paste, but markdown-it with html:true converts to clean HTML that TipTap's setContent() accepts without loss. Pair this with explicit backend LLM prompt instructions to output markdown format (## headings, **bold**, - bullets) for consistency. In RoleNext (April 2026), this pattern replaced both a custom stripWrapper() parser and the tiptap-markdown extension when fixing resume/cover letter editors that needed to render LLM-generated content.
