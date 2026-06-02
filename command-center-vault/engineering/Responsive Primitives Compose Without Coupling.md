---
pillar: engineering
title: Responsive Primitives Compose Without Coupling
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - components
  - composability
  - responsive
aliases:
  - primitive design
---

Build small, single-purpose UI primitives (AnimatedNumber, Sparkline, SegmentedBar) that compose cleanly into larger surfaces.

New dashboard components include AnimatedNumber (count-up with useInView and prefers-reduced-motion), Sparkline (SVG with draw-in pathLength animation and terminal dot fade-in), SegmentedBar (funding bar with min-8% segments and diagonal-hatch empty state), and StatCell (discriminated union for hero/satellite layouts). These primitives are fully tested and compose into StatsBand and PipelineBand without coupling. Each primitive owns its own animation and responsive behavior, so they're reusable in future dashboards.
