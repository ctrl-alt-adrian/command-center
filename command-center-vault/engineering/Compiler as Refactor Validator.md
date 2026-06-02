---
pillar: engineering
title: Compiler as Refactor Validator
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - refactoring
  - validation
  - go
---

For large refactors that change function signatures across many files, the compiler catches incompleteness better than code review.

After propagating context across 13 files, validating with go build caught all missing updates. For refactors that touch many call sites (adding required parameters, changing signatures), the compiler is a more effective validator than code review. It's authoritative on completeness.
