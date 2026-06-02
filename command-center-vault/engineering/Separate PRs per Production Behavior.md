---
pillar: engineering
title: Separate PRs per Production Behavior
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - production-hardening
  - code-organization
  - reviewability
aliases:
  - independent-reviewer-gates
---

Split six related production-hardening behaviors into six separate PRs rather than combining them, accepting inevitable merge conflicts as the cost of independent reviewability.

Each PR gates exactly one behavior (DB SSL, HSTS, rate limits, migration guard, CORS, .env templates) on APP_ENV. This makes each PR easy to review, revert, or merge in any order. Two PRs both modified db.Open(), creating merge conflicts, but the resolution was trivial: both changes just needed to coexist. The benefit of independent reviewability outweighed the minor rebasing cost. This pattern works well when behaviors are related but orthogonal — each can ship independently.


## Related

- [[Parallel Explore-Then-Implement Agents]]
