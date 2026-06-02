---
pillar: engineering
title: Large-Scale Frontend Refactors Follow a Four-Phase Progression
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - refactor
  - methodology
  - risk-management
  - code-quality
aliases:
  - phased-refactoring
  - multi-phase-methodology
  - refactor-phases
---

Structure, then performance, then security, then accessibility. Each phase produces focused PRs that don't duplicate work.

When refactoring 30+ files, breaking work into four sequential phases prevents churn and keeps PRs reviewable. RoleNext's approach: Phase 1 deduplicates code (extract GridBackground, consolidate handlers into useMutation), Phase 2 optimizes performance (add React.lazy, query key factory, useCallback), Phase 3 hardens security (timedFetch, error handling, sanitization), Phase 4 polishes accessibility (aria labels, semantic HTML, error states with retry). Each phase builds on the last; skipping structure to optimize early creates churn when you later consolidate. Running all four across 4 separate PRs kept the scope clear and test pass rate at 179/179 throughout.


## Related

- [[Accessibility Deserves Its Own Refactor Phase, Not a Polish Pass]]
- [[Extract Duplicate Components Before Adding Performance Optimizations]]
