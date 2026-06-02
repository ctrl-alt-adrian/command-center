---
pillar: engineering
title: HTML Structure Parsing Preserves Formatting in PDF Export
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pdf-generation
  - formatting
  - html-parsing
aliases:
  - PDF formatting preservation
  - semantic HTML in PDFs
---

Instead of stripping HTML tags when exporting to PDF, parse the structure: headings render at correct sizes, inline formatting via HTML parsing, lists render correctly, text alignment is honored.

When exporting rich-text editor content to PDF, the instinct is to strip all formatting and flatten to plain text. Better: parse the HTML structure semantically. In RoleNext, the PDF generator (fpdf.HTMLBasicNew in Go) consumes TipTap's editor HTML directly—headings become proper H1/H2/H3 sizes, bold and italic text are preserved, ordered lists render with numbers, and text-align CSS is respected. Requires embedding font variants (Noto Sans Italic, BoldItalic) for proper italic rendering. This preserves document hierarchy without custom tag-stripping logic.
