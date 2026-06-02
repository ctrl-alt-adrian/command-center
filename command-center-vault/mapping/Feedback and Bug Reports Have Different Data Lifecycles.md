---
pillar: mapping
title: Feedback and Bug Reports Have Different Data Lifecycles
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - feedback
  - data-modeling
  - support
---

Feedback (sentiment metrics) and bug reports (triage items) are fundamentally different data types and should be stored and handled separately.

RoleNext moved star ratings from GitHub Issues to PostgreSQL while keeping bug reports in GitHub for triage. Feedback is analytics data (you aggregate it for trends). Bug reports are actionable items needing discussion, status tracking, and code context. Treating them in the same tool created noise and complexity. Separating them means feedback is simple (DB insert, optional retention window) while bugs stay close to development. When two data streams come from the same user action but serve different purposes (analytics vs triage), split them early.
