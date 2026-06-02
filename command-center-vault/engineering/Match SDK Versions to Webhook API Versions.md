---
pillar: engineering
title: Match SDK Versions to Webhook API Versions
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - webhooks
  - stripe
  - sdk-integration
  - dependency-management
---

Upgrade the SDK if webhook API versions mismatch, rather than suppressing the warning.

During rolenext's Stripe integration, stripe-go v82 targeted API version 2025-08-27.basil, but Stripe CLI forwarded webhooks using 2026-03-25.dahlia. Rather than using IgnoreAPIVersionMismatch, the team upgraded to stripe-go v85, which has type definitions for the newer API. This prevents silent type mismatches and runtime surprises. Suppressing the mismatch trades short-term convenience for fragility. Upgrading ensures the code is actually correct.


## Related

- [[Webhook integration patterns]]
- [[Dependency management]]
