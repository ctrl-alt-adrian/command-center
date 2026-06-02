---
pillar: engineering
title: Terminology as First-Class Infrastructure
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - code-organization
  - duplication
  - consistency
---

Treating domain language as centralized infrastructure prevents duplication across distributed components.

In RoleNext's skill-gap refactor, extracting terminology into a centralized `terminology.ts` utility eliminated duplication across 25+ UI surfaces. Rather than hardcoding terms in components, a single import source ensures consistent language across dashboard, search, interview prep, and result cards. This works because terminology is already a coordination problem: when product language changes, you either update everywhere or accept inconsistency. Treating it as infrastructure costs almost nothing upfront and compounds as the codebase grows.
