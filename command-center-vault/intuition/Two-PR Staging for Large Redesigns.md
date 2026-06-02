---
pillar: intuition
title: Two-PR Staging for Large Redesigns
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pr-strategy
  - code-review
  - redesign
  - shipping
---

Split large redesigns into foundation + rewrite, not monolithic PR or three half-finished states.

Split large redesigns as foundation + rewrite. RoleNext search page added editorial-restrained primitives (PR #215), then rewrote the page to consume them (PR #216). Monolithic PR would be too large to review; three-PR sequencing with intermediate states leaves the page half-redesigned mid-flight. Two PRs keep each review focused while maintaining a working product throughout.


## Related

- [[Code Review]]
- [[Shipping Velocity]]
