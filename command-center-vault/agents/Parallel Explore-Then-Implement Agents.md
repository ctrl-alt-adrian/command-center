---
pillar: agents
title: Parallel Explore-Then-Implement Agents
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - parallel-execution
  - agent-architecture
  - efficiency
aliases:
  - explore-first-pattern
---

Spawn read-only explore agents first to build understanding, then launch implementation agents in parallel worktrees, each with self-contained prompts containing all necessary context.

Five explore agents read the codebase (backend db, billing db, security, rate limiter, logging patterns) to identify all the places each PR would need to touch. Then six implementation agents spawned in parallel, each isolated in a worktree. Each agent got a prompt with current code, all caller sites, test templates, branch names, and commit messages. Agents discovered callers not listed in the prompt and fixed them independently. Total wall time for all six PRs: roughly 4 minutes. This pattern works when you have a cluster of related work that's independent enough to parallelize but interdependent enough that context-sharing saves work.


## Related

- [[Separate PRs per Production Behavior]]
