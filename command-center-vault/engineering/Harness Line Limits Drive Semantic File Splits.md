---
pillar: engineering
title: Harness Line Limits Drive Semantic File Splits
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - harness
  - hooks
  - refactoring
  - constraints
---

When a file hits a harness line-count limit, split by semantic responsibility, not arbitrary size.

RoleNext's sampleData.ts was approaching a 400-line hook limit. Rather than split randomly, SAMPLE_SKILL_GAPS moved to sampleSkillGaps.ts—a clean separation by domain responsibility. When a harness constraint forces a decision, use it to surface a better organization, not to rationalize an arbitrary split.
