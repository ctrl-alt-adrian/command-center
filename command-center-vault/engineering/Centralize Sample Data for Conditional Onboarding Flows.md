---
pillar: engineering
title: Centralize Sample Data for Conditional Onboarding Flows
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - onboarding
  - sample-data
  - ux
  - code-organization
aliases:
  - demo data pattern
  - onboarding data injection
---

Extract sample data to a dedicated file and conditionally inject it during tutorials instead of scattering it across components.

New users in RoleNext need to see example job cards during onboarding, but the codebase has no sample data by default. Instead of inlining sample objects in components or adding conditional branches everywhere, sample data was centralized in sampleData.ts and conditionally shown only when the tutorial is active and real data is empty. Pages render sample data the same way they render real data; the data source toggles, not the rendering logic. This reduces branching complexity and makes it easy to update examples in one place.
