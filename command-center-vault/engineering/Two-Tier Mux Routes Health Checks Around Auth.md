---
pillar: engineering
title: Two-Tier Mux Routes Health Checks Around Auth
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - go
  - http
  - auth
  - health-check
  - pattern
---

Separate health endpoints from your auth-protected API mux to avoid carving exceptions into auth middleware: root mux for /health and /ready, inner mux for protected routes.

RoleNext backend uses a two-tier mux pattern. The outer rootMux handles /health (returns 200 with no dependencies) and /ready (pings the database with a 2s timeout, returns 503 if unreachable), both without auth. The inner apiHandler chain (securityHeaders, rateLimit, cors, auth, protected routes) handles /api/*. This avoids the complexity of routing around auth middleware and keeps health checks lightweight and always available.
