---
pillar: engineering
title: Empty VITE_API_URL env var preserves dev proxy; absolute URL in production
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - frontend
  - deployment
  - environment-variables
  - architecture
aliases:
  - cross-origin fetch pattern
---

When frontend and backend are on separate domains (Vercel and Railway), prefix all fetch calls with VITE_API_URL. Set it to empty in dev (relative paths use Vite proxy) and absolute URL in prod.

The frontend initially used relative /api/ paths, relying on Vite's dev proxy. This breaks when Vercel frontend calls Railway backend on different domains. Solution: wrap all fetch calls with a VITE_API_URL prefix. Empty string in dev = relative paths = dev proxy still works. In prod, set it to https://api.rolenext.com. No library swaps needed; custom fetch already handles Authorization headers correctly across origin boundaries.
