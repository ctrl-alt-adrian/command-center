---
pillar: engineering
title: Verify Plan Agent Outputs Against Implementation
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - planning
  - verification
  - audit
---

Don't trust plan agent specs as gospel. Verify technical details against the actual source code.

RoleNext's Plan agent proposed 30/30/25/15 weights for the scoring model. Grepping backend/scoring/candidate.go revealed the actual weights: 45/20/15/20. The error would have propagated into FitBreakdownBars. Generated specs require verification against source of truth before you build on them.
