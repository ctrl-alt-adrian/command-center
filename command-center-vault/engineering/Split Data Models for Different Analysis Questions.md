---
pillar: engineering
title: Split Data Models for Different Analysis Questions
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - data-modeling
  - separation-of-concerns
  - aggregation
---

Different analysis questions need different data structures; fusing them creates coupling.

A single data structure often serves multiple analysis questions poorly. RoleNext separated individual skill gaps from aggregated patterns into two modules: raw gap calculation (answering 'what's missing?') vs. aggregation and ranking (answering 'what matters most for this role?'). This separation reduced coupling between different analysis paths, made each module's responsibility clear, and let the team iterate on weighting and classification independently. Two shapes for two questions beats one shape forced to answer both.
