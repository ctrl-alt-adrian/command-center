---
pillar: engineering
title: Webhook Signature Verification Closes Trust Loop
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - webhooks
  - security
  - stripe
  - verification
aliases:
  - Webhook Trust
  - Signature Verification
---

Always verify webhook signatures before processing events; this prevents forged webhook attacks on payment operations.

When Stripe sends webhooks (subscription.created, subscription.updated, etc.), verify the signature using STRIPE_WEBHOOK_SECRET before processing. Extract the secret from stripe listen --forward-to output during local development and store it in environment variables. Use the Stripe SDK to validate each event. In RoleNext, this validates that subscription updates are genuine before calling db.UpdateSubscription(). Skipping verification exposes the system to forged events that could escalate a user to a paid plan without payment.


## Related

- [[Metadata for Cross-System User Tracking]]
- [[Remove Auth Bypasses Before Hardening]]
