---
pillar: engineering
title: Staging environment catches infrastructure bugs that dev environment cannot
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - deployment
  - staging
  - environment-strategy
aliases:
  - test environment roi
---

Even with dev and prod, staging is worth the cost because it catches infra-only bugs: real DNS, SSL termination, CDN behavior, OAuth redirects on real domains, Stripe webhooks hitting real endpoints, SSE buffering through load balancers.

Dev runs locally with Vite dev proxy hiding infra problems. Prod runs the real stack. Staging between them is not redundant because Vite proxy masks SSL termination issues, load balancer SSE buffering, real DNS delays, and OAuth provider redirect validation. Clerk OAuth specifically requires real domains — localhost won't work. Stripe webhooks need to hit your real domain. These bugs only surface under real infra. The cost is minimal (staging can run tiny instances) but the bug-catch value is real. Don't skip staging just because dev and prod exist.
