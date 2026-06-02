---
pillar: engineering
title: Use Real Auth Tokens in Integration Tests
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - auth
  - testing
  - integration-tests
  - clerk
aliases:
  - Real token testing
---

Replace environment-variable auth bypasses with a dedicated test user and long-lived JWT token.

rolenext initially used ROLENEXT_TEST_USER env var to bypass Clerk auth in tests. The user rejected this shortcut. Solution: create a test Clerk user with a 1-year JWT template, stored in testing/.env (gitignored). Tests use the real token and run against actual auth constraints. This catches bugs that bypasses miss: JWT validation, token refresh, permission checks, token expiration. Real-token tests cost more in speed, but they catch integration bugs that matter in production. For auth-protected features, the investment pays off.


## Related

- [[Auth integration patterns]]
- [[Reducing test-production gaps]]
