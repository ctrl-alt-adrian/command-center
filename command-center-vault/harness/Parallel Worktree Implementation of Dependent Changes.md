---
pillar: harness
title: Parallel Worktree Implementation of Dependent Changes
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - git
  - workflow
aliases:
  - Worktree Parallelism
---

Spawn parallel worktrees to implement dependent PRs simultaneously; git branches are shared, so push from main repo.

When implementing a sequence of dependent database changes across multiple PRs, create isolated worktrees for each PR and implement them in parallel on separate branches. Git branches are shared across worktrees, so you can push from the main repo and each worktree stays on its own branch. Accelerates the chain without blocking on single PR completion. Applied in rolenext database audit (PRs #172-173).
