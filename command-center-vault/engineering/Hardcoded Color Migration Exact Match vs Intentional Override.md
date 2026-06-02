---
pillar: engineering
title: 'Hardcoded Color Migration: Exact Match vs Intentional Override'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - theming
  - refactoring
  - design-tokens
  - css
---

When replacing hardcoded colors with tokens, preserve intentional color choices via dark: overrides.

When migrating hardcoded hex colors to semantic tokens, distinguish two cases. Colors that match theme tokens exactly (like #258FBF matching primary) should be replaced entirely with the token. Colors that were intentionally chosen to differ from tokens (like #636B7C for form labels, darker than muted-foreground) should keep the light value and add dark: overrides instead. This approach preserves the exact light-mode appearance while fixing dark mode without losing intentional design choices. Applied during RoleNext's replacement of 52 hardcoded colors across 8 files.
