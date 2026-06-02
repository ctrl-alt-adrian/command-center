---
pillar: engineering
title: Centralized Terminology Prevents Cross-Component Drift
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - consistency
  - terminology
  - design-systems
  - maintainability
aliases:
  - Terminology module pattern
  - Language consistency anchor
---

Single source for domain-specific language prevents inconsistent wording as UI grows.

When your domain has specific terminology (like occupation-aware language in skills data), centralizing definitions in a module prevents the same concept being named differently across components. As the app scales, terminology naturally drifts without this anchor. RoleNext's terminology.ts module ensures consistent language across the dashboard, forms, and API responses, reducing cognitive load for both developers and users.
