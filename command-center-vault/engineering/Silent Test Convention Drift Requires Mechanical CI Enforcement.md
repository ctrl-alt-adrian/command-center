---
pillar: engineering
title: Silent Test Convention Drift Requires Mechanical CI Enforcement
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - conventions
  - ci
  - standards
---

Test assertion patterns accumulate silently across a codebase unless enforced mechanically at CI time.

RoleNext had mixed test patterns without explicit decision: some modules used testify assertions, others used stdlib; some CSS tests checked classes directly, others didn't. Code review alone misses this—the drift is too gradual and the offense too minor per commit. Mechanical CI enforcement catches convention violations before merge, preventing the slow creep toward unmaintainable heterogeneity that makes large test suites brittle.
