---
pillar: intuition
title: Validate Best Practices Against Industry Standards Before Codifying Rules
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - best-practices
  - rules
  - validation
  - process
aliases:
  - audit-before-fixing
  - practice-validation
  - rule-codification
---

Audit the codebase comprehensively, identify gaps in team rules, validate each gap against industry standards, then codify.

A full frontend audit revealed 38 issues and 7 uncaptured best practices. Before fixing code, each practice was validated against its source: TanStack Query docs (query key factory, useMutation patterns), OWASP (fetch timeouts, HTML sanitization), WCAG 2.1 (accessibility guidelines). Five practices were codified into new rule files (.claude/rules/react-style.md, .claude/rules/accessibility.md). Two were already covered by existing rules; the audit just exposed gaps in code compliance, not gaps in guidance. This approach prevents ad-hoc fixes from drifting into patterns the team never intended. The codified rules then became enforcement gates for the four-phase refactor.


## Related

- [[Accessibility Deserves Its Own Refactor Phase, Not a Polish Pass]]
- [[Large-Scale Frontend Refactors Follow a Four-Phase Progression]]
