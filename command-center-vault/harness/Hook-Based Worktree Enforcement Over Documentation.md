---
pillar: harness
title: Hook-Based Worktree Enforcement Over Documentation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - developer-experience
  - automation
  - hooks
  - git
aliases:
  - branch-isolation
  - hook-automation
---

Prevent parallel-task branch collisions by enforcing worktree-per-task via a PreToolUse hook that blocks git commits outside a worktree.

Documenting 'use a worktree for each task' fails because developers skip it under pressure. Mirukai added a PreToolUse hook that prevents git commit execution outside a worktree, surfacing a clear error instead of silently allowing violations. The hook is a hard constraint rather than a guideline, eliminating branch collisions in parallel development without requiring discipline. Error messages on constraint violation beat documentation every time.


## Related

- [[Git Workflow Automation]]
- [[Developer Experience Patterns]]
