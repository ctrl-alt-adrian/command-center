---
pillar: engineering
title: Promise.all Silent Catch Returns Empty Cascades Downstream
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - error-handling
  - promises
  - debugging
---

Catch blocks on Promise.all that return partial or empty results silently cascade failures downstream.

Marketing-pipeline's generate.ts line 216 had Promise.all(...).catch(() => [platform, '']). When a platform call failed, the catch returned empty content string. This empty string flowed downstream into slop-check without any signal that it came from an error. The fix: log the error with source context (worker:generate:platform) and rethrow with the platform name in the message. Let failures propagate clearly instead of masking them with partial results.
