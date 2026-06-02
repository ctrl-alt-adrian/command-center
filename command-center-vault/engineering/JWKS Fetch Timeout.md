---
pillar: engineering
title: JWKS Fetch Timeout
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - timeout
  - http-client
  - auth
  - resilience
---

Set a short HTTP timeout on the JWKS client to prevent auth middleware from hanging.

Added a 10-second timeout to the HTTP client used for Clerk JWKS fetches. This prevents the auth middleware from blocking indefinitely if the JWKS endpoint is slow or unavailable. External API calls should always have timeouts; for identity-critical paths like auth, err on the side of fast failure over correctness.


## Related

- [[HTTP Client Design]]
- [[Auth Middleware]]
