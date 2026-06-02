---
pillar: engineering
title: Centralized Terminology Module Prevents Cross-Component Language Drift
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - terminology
  - consistency
  - architecture
  - ui-language
aliases:
  - language module
  - terminology extraction
---

Extract shared UI language into a single module to avoid phrasing inconsistency across many components and unblock future changes.

When skill-gap language scattered across 25+ components, consistency breaks and bulk changes become merge-heavy. RoleNext centralized context-aware phrasing into a single `terminology.ts` module—search results, dashboards, interview prep now all reference the same rules. Changes ripple consistently. The module also unblocks future localization: language rules live in one place, not scattered across the codebase.


## Related

- [[Schema API Contracts]]
- [[Cross-Component Refactoring]]
