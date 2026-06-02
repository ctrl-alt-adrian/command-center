---
pillar: intuition
title: Environment Support Is a Pre-Launch Gate, Not Post-Ship Polish
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pre-launch
  - environment-support
  - gating
  - planning
---

Foundational infrastructure like environment-specific configuration (dev/staging/prod) must be in place before launch. Recognizing this prevents shipping incomplete guards.

During rolenext pre-launch work, an attempt to ship a one-line Stripe live-mode guard surfaced a bigger problem: the app had no proper dev/staging/prod environment support. Rather than ship an incomplete guard, the user planned full environment support and deferred it as a pre-launch blocker. Seven checklist items were marked `[BLOCKED: env]`, including DB SSL/TLS, HSTS headers, structured JSON logging, and Stripe live-mode verification. The insight: environment work isn't polish—it's foundational. Small guards that depend on it should wait.
