---
pillar: intuition
title: Remove Auth Bypasses Before Hardening
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - auth
  - security
  - testing
  - bypass
aliases:
  - Bypass Removal
  - Real Auth in Tests
---

Remove environment-variable auth bypasses in favor of real credentials before deploying security-sensitive features.

RoleNext had a ROLENEXT_TEST_USER auth bypass that skipped Clerk JWT verification during testing. Before wiring the payment flow end-to-end, this bypass was removed and replaced with real Clerk JWTs loaded from testing/.env. The decision: testing against real credentials ensures the auth system works as deployed and prevents surprises when payment operations depend on correct identity. Auth middleware now uses auth.WithUserID() helpers for Go unit tests instead of env-var shortcuts.


## Related

- [[Webhook Signature Verification Closes Trust Loop]]
