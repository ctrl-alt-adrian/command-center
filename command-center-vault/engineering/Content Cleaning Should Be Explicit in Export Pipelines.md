---
pillar: engineering
title: Content Cleaning Should Be Explicit in Export Pipelines
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pdf
  - export
  - normalization
---

PDF export pipelines should include an explicit normalization step that strips HTML tags and Markdown formatting markers, not rely on implicit filtering downstream.

The rolenext PDF export pipeline was rebuilt to include a `cleanForPDF()` function that runs content through HTML stripping and removes Markdown bold markers (`**` and `__`). This prevents artifacts like double-asterisks from appearing in exported PDFs. Making this step explicit and testable (via table-driven tests) ensures the output is predictable regardless of changes to the input source.


## Related

- [[Font Glyph Coverage Is a Pipeline Blocker]]
