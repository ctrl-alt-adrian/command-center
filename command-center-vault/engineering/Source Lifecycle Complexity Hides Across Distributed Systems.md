---
pillar: engineering
title: Source Lifecycle Complexity Hides Across Distributed Systems
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - coupling
  - source-management
  - maintenance
aliases:
  - source-coupling
  - hidden-coupling
---

Removing a single anime source touches migrations, commands, traits, health checks, and caches—there is no single source-of-truth.

When Mirukai dropped HiAnime, the work spanned: migration versioning (cache schema updates), command wrappers (source registry), resolver trait implementations, health diagnostics, and in-memory caches. The coupling is not visible from any one angle, making the true maintenance cost opaque until you try it. This pattern suggests source abstraction needs rethinking—either converge on a single registry point, or make coupling explicit through documentation.


## Related

- [[System Coupling Patterns]]
- [[Abstraction Design]]
