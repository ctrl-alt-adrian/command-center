---
pillar: engineering
title: Hidden Conventions Surface When Expanding Small Tasks
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - refactoring
  - code-discovery
  - scope
---

Attempting to implement a simple feature can uncover undocumented conventions or hidden patterns in the codebase. Use these discoveries to decide whether to expand scope or defer.

During rolenext pre-launch work, an attempt to add a Stripe live-mode startup guard revealed that `services/billing/auth/middleware.go` already used an undocumented `GO_ENV` convention. This discovery prompted a conversation about whether to ship a one-liner or design proper environment support. The user chose to defer and plan environment support properly. The pattern: small tasks often lead to bigger questions about consistency and conventions.


## Related

- [[Environment Support Is a Pre-Launch Gate, Not Post-Ship Polish]]
