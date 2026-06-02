---
pillar: engineering
title: Verify Tool Constraints Before Proposing Solutions
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - ci
  - tooling
  - constraints
---

Check environment compatibility before recommending a tool replacement.

When the npm audit endpoint broke, osv-scanner seemed like a drop-in replacement. But osv-scanner v2 requires Go 1.26.1+, while the CI environment runs Go 1.25. The go install approach failed at runtime, not in planning. Before proposing a tool fix, verify it works with actual CI constraints: Go version, available package managers, reusable workflow support.
