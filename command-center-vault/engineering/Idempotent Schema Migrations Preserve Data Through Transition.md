---
pillar: engineering
title: Idempotent Schema Migrations Preserve Data Through Transition
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - database
  - migration
  - zero-downtime
---

IF NOT EXISTS patterns let schemas support both old and new data models during gradual rollout.

Schema migrations that support both old and new data models simultaneously require idempotent patterns to run safely multiple times without data loss. RoleNext used IF NOT EXISTS conditions when migrating the skill gap schema to support impact-weighted aggregation, allowing old data to coexist with new patterns during the transition phase. This unblocks multi-phase rollouts where frontend, backend, and data shape can't change in lockstep.
