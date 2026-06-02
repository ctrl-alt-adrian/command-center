---
pillar: intuition
title: 'Color Contrast Audit: Scope Your Fixes to Component Level'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - wcag
  - color-contrast
  - design-system
  - accessibility
aliases:
  - WCAG AA scoping
  - token-level vs component-level fixes
---

When a contrast audit reveals a base design token fails WCAG AA, decide carefully: fix the token (affects the whole visual design) or fix component-specific amplifiers (safer, scoped). Document the trade-off explicitly.

In rolenext kanban (2026-04-13), the muted-foreground base token (HSL 222 7% 64%) only achieves 3.86:1 contrast against white — below the 4.5:1 WCAG AA threshold. Changing the token would improve contrast everywhere but would alter the app's visual design system. Instead, fixed the kanban-specific amplifiers: removed the /40, /70, and /50 opacity reductions that were darkening text. Also darkened score badge foreground text in light mode (text-green-700) while keeping it the same in dark mode. This is a pragmatic scoping decision: fix what's clearly broken in the component without redesigning the system. The base token issue still exists and should be reviewed at the design-system level.
