---
pillar: engineering
title: Font Glyph Coverage Is a Pipeline Blocker
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pdf
  - fonts
  - unicode
  - export
---

PDF export failures due to missing glyphs should be caught early by using fonts with comprehensive Unicode coverage, not discovered at ship time.

During rolenext PDF export testing, rendered PDFs were corrupting certain punctuation—specifically non-breaking hyphens (U+2011). The root cause: Liberation Sans doesn't include this glyph. The fix was to switch to Noto Sans, which has broader Unicode coverage. This is a pipeline-level decision, not a formatting tweak—the choice of embedded font directly affects which input documents can be reliably exported. If you're bundling a font for PDF export, verify its glyph coverage against the character set that might appear in your content.


## Related

- [[Empty PDF Detection Prevents Silent Upload Failures]]
