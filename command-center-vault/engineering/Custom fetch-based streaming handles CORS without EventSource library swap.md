---
pillar: engineering
title: Custom fetch-based streaming handles CORS without EventSource library swap
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - frontend
  - streaming
  - cors
  - architecture
aliases:
  - sse cross-origin
---

If your app uses custom fetch-based streaming instead of native EventSource, CORS is already solved because fetch attaches Authorization headers; no library migration needed for cross-origin deployment.

The app's streaming implementation is fetch-based, not EventSource. This was already CORS-compatible because fetch includes Authorization headers automatically. This means moving to a cross-origin architecture (separate Vercel and Railway domains) does not require swapping to a CORS-aware streaming library. The custom implementation already handles it.
