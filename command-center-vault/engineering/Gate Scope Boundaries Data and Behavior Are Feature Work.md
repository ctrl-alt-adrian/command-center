---
pillar: engineering
title: 'Gate Scope Boundaries: Data and Behavior Are Feature Work'
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - scope
  - policy
---

A style-only gate doesn't cover work that adds data fields, components, or behavior, even with a design mockup.

RoleNext's explainable scoring frontend added 8 new fields to AnalysisResult, new utility functions, and new components. That's feature work, not style-only re-implementation. A design mockup is an artifact, not a scope boundary. If the work changes the data model or adds behavior, it's feature scope, regardless of whether Pencil has it drawn.
