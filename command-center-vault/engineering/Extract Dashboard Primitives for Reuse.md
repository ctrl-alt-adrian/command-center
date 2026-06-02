---
pillar: engineering
title: Extract Dashboard Primitives for Reuse
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - components
  - reusability
  - architecture
  - abstraction
aliases:
  - Component extraction pattern
---

Build sparkline and delta components as reusable primitives, not dashboard-only implementations.

When adding dashboard features, extract visual patterns as standalone components from the start. The RoleNext sparkline and delta indicator components aren't dashboard-specific; they're built as primitives that any feature can use. Enables consistent visualization patterns across the app without reimplementing the same UI logic, and makes it easy to evolve the components in one place.
