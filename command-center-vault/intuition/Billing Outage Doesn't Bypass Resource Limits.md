---
pillar: intuition
title: Billing Outage Doesn't Bypass Resource Limits
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - service-failure
  - defensive-defaults
  - billing
aliases:
  - fail-safe defaults
---

When a billing service is down, treat users as non-admin and apply resource limits. Don't unlock features on external failure.

The admin exemption from the resume limit relies on a billing service call. If the billing service is down, the call fails with an error. The code treats this as 'not admin' and applies the limit anyway. This defensive default prevents unlimited uploads if billing is temporarily unreachable. Skipping the limit check on billing failure would leak an important constraint during outages.
