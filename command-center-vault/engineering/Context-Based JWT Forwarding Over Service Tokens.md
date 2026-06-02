---
pillar: engineering
title: Context-Based JWT Forwarding Over Service Tokens
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - auth
  - jwt
  - context
  - service-to-service
---

Forward user JWTs from API middleware to service clients via context, eliminating separate service tokens.

Replaced an environment-based service token + X-User-ID header pattern with: middleware extracts and stores the verified Clerk JWT in context, service clients extract it at call time and forward as Authorization: Bearer. This eliminates the need for a separate service credential, simplifies the credential model, and makes token scope explicit at the point of use. Verification shifted from the service authenticating a separate credential to validating the forwarded user JWT directly. Implemented in rolenext billing service.


## Related

- [[Auth Middleware Patterns]]
- [[Context Propagation]]
