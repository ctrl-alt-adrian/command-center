---
pillar: engineering
title: Reusable visualization primitives ensure consistent styling across surfaces
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - components
  - reusability
  - consistency
  - ui-patterns
---

Building DeltaIndicator and Sparkline as separate, reusable components prevents divergent styling across the dashboard.

Delta indicators (% changes with ↑/↓ symbols and color coding) and sparklines appear on multiple dashboard surfaces. Without a single component implementation, each usage made its own decisions about formatting: decimal places, edge cases like >100% changes, symbol placement. Building DeltaIndicator and Sparkline as reusable primitives enforced one set of rules across the entire product. This is more valuable than code reuse—it's behavioral consistency that users notice and trust.
