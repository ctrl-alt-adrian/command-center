---
pillar: engineering
title: Graceful Frontend Handling for Disabled Endpoints
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - http-api
  - error-handling
  - frontend
aliases:
  - 404 for disabled features
---

Return 404 when an endpoint is intentionally disabled, and have the client detect the status to show a context-specific message.

When RoleNext disabled bug report submission (keeping the UI present but non-functional), the backend returned 404. The frontend checked the response status and displayed a friendly message: 'Bug reporting is not available right now.' This is cleaner than returning a generic error code, because 404 semantics communicate the real situation (the endpoint doesn't exist), and the client can branch on status rather than parsing response bodies for custom signals.
