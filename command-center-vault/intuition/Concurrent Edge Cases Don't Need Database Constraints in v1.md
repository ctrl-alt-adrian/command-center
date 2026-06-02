---
pillar: intuition
title: Concurrent Edge Cases Don't Need Database Constraints in v1
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scaling
  - race-conditions
  - pragmatism
  - over-engineering
aliases:
  - accept appropriate risk
  - know your scale
---

For low-concurrency single-user tools, accept that two simultaneous requests at the limit can both pass the check. Database constraints would add complexity without solving a real problem.

The resume limit check is in application code, not the database. Two uploads from the same user at exactly 5 resumes could both pass the count check and create a 6th resume due to race condition. For a personal productivity tool with low concurrency per account, this probability is negligible and the outcome (one extra resume) is benign. Adding a database trigger or CHECK constraint would increase deployment complexity and schema brittleness. Know your product's scale and accept appropriate risks rather than adding defensive machinery for hypothetical edge cases.
