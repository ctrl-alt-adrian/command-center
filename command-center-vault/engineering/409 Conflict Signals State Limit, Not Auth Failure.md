---
pillar: engineering
title: 409 Conflict Signals State Limit, Not Auth Failure
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - http-semantics
  - error-handling
  - billing
aliases:
  - state conflict error
---

Use 409 Conflict for resource-per-account caps, not 403 Forbidden, to avoid triggering auth-failure handling downstream.

The existing billing gate system uses 403 for plan-gated features. Reusing 403 for a hard resource limit (5 resumes per account) would conflate authorization checks with state conflicts. 409 Conflict accurately signals 'the request conflicts with the current state (account already has 5 resumes)' without triggering billing error flows designed for auth failures. This keeps error semantics clean and prevents misrouting in client-side error handlers that check for status === 403.
