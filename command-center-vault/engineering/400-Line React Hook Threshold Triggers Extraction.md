---
pillar: engineering
title: 400-Line React Hook Threshold Triggers Extraction
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react
  - hooks
  - refactoring
  - code-organization
aliases:
  - hook size limits
  - component extraction trigger
---

When a React file approaches 400 lines, extracting self-contained logic becomes necessary rather than optional.

RoleNext's SettingsPage hit 430 lines before adding a Preferences card for the onboarding tutorial. A pre-commit hook enforces a 400-line max. The avatar upload logic (select, crop, mutation handlers, loading state) formed a clean boundary with a single responsibility: take clerkUser and an error callback, return handlers. Extracting it to useAvatarUpload saved 65 lines, bringing the file to 380 lines with the new card included. The threshold marks where single-file complexity becomes hard to reason about. At that point, extract-before-adding is cheaper than post-hoc refactoring.
