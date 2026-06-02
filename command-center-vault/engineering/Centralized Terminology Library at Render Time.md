---
pillar: engineering
title: Centralized Terminology Library at Render Time
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - terminology
  - frontend-backend-sync
  - data-consistency
---

Centralizing job-market terminology in a library mapped at render time keeps frontend and backend in sync without database changes.

Occupation-aware language matters for credibility — users expect interview prep to reflect actual job market terminology. Rather than embedding terminology strings throughout components or baking standardized language into the database schema, the team built a centralized terminology.ts library that maps at render/response time. This lets terminology tweaks propagate without migrations and keeps all surfaces (dashboard, interview prep, search) using the same words. Scattered string literals create drift; centralized libraries prevent it.
