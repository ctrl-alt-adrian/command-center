---
pillar: engineering
title: Global Primitives Restyle for Design Consistency
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - design-system
  - global-components
  - consistency
aliases:
  - global component inheritance
---

Update global Layout, Dialog, and DropdownMenu once so all pages inherit the new design chrome automatically, rather than per-page overrides.

The dashboard redesign required Layout header, Dialog, and DropdownMenu updates. Instead of per-page customization, these were updated globally so future surfaces inherit the editorial treatment by default. Layout now shows a plan badge as outline, 26px avatar with mono initials, and an eyebrow-labeled email dropdown. All modals and menus use the new chrome without additional wiring. This saves work on the next surface and ensures consistency without enforcement.


## Related

- [[Lock Design Workflow After First Successful Handoff]]
