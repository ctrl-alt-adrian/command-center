---
pillar: engineering
title: Test Bypasses Respect Logic Boundaries
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - test-doubles
  - auth
  - billing
---

When adding a test bypass for one system layer, don't use the same flag to bypass unrelated layers.

In the RoleNext test pipeline, both auth and billing used the same HIRELENS_TEST_USER env var for test-mode bypasses. The auth middleware correctly skipped JWT validation when that var was set, but the billing middleware also skipped plan-limit enforcement. This caused billing tests to pass incorrectly. They returned 200 for scenarios that should have been blocked due to quota. Auth and billing are separate concerns. Auth can permissively skip token validation in test mode; billing still needs to enforce its limits. Separate the bypass flags or guard each bypass independently.


## Related

- [[Real User IDs Reduce Test Auth Abstraction]]
