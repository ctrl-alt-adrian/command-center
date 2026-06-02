---
pillar: engineering
title: Hardcoded Colors Reveal Scattered Architecture
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - refactoring
  - design-systems
  - rolenext
---

Attempting to consolidate colors into tokens reveals how scattered color definitions are throughout the codebase, signaling architecture debt.

During RoleNext's dark-theme refactor, moving from hardcoded colors to a token system required a systematic audit of the entire codebase. This audit revealed that colors were scattered throughout, making compliance verification and future theme changes difficult. The lesson: a token-migration project is a good forcing function to discover and quantify architecture debt. It's not just cleanup; it's a diagnostic for hidden problems.


## Related

- [[Theme Tokens Enable Accessibility Enforcement]]
