---
pillar: engineering
title: 4-Phase Refactor by Problem Category
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - refactor
  - methodology
  - code-audit
aliases:
  - phase-refactor-strategy
---

Structure refactors first; then add infrastructure constraints; then schema consistency; finally security hardening. Each phase targets a distinct issue category.

When facing 84 issues across 25 files, sequence the refactor by problem type, not file order. Phase 1 tackles structural problems (oversized files, dead code, redundancy). Phase 2 adds infrastructure (HTTP timeouts, DB pooling, context threading). Phase 3 enforces schema consistency (timezone types, data representation). Phase 4 hardens security and retry behavior. This order lets each phase build on stable foundations and prevents later phases from undoing earlier gains. Discovered during a backend audit of the RoleNext skill-normalization feature.


## Related

- [[Domain-Driven File Splitting Reduces Cognitive Load]]
- [[Systematic Code Audit Reveals Systemic Gaps]]
