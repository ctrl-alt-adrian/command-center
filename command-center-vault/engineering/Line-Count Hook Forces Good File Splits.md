---
pillar: engineering
title: Line-Count Hook Forces Good File Splits
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - refactoring
  - file-organization
---

Pre-commit line-count limits can force beneficial file splits that reveal natural boundaries.

When a pre-commit hook enforces max 400 lines per file, it can trigger a split you might not do consciously. In the db-audit work, handler.go exceeded 400 lines after context propagation. Extracting validateAndWrapFile, extractText, and allowedMIMETypes to file_utils.go revealed a clean separation: pure file-handling utilities vs HTTP logic. The constraint forced better separation of concerns.
