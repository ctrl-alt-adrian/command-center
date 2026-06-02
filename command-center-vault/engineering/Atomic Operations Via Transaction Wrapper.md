---
pillar: engineering
title: Atomic Operations Via Transaction Wrapper
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - database
  - transactions
  - consistency
---

Wrapping related DB operations in a deferred-rollback transaction ensures atomicity and prevents partial failures.

SaveJob followed by AddSkillGapEntries is a consistency hazard. If the second fails, the job is saved but skill gaps are inconsistent. Wrapping both in a transaction helper makes them atomic: both succeed or both roll back. The helper defers a recover to prevent leaked transactions if a panic occurs mid-operation.
