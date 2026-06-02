---
pillar: harness
title: Parallel Agents Discover Hidden Dependencies
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - agents
  - refactoring
  - compilation
---

When refactoring at scale, splitting work across parallel agents by concern area discovers files not in the original plan.

When refactoring at scale (adding ctx to 40+ methods across 9 files), split work across parallel agents by region of concern: simple files, complex files, handlers. Each agent compiles and fixes errors. This discovers files not in the original plan. In the db-audit work, agents found tracker.go and youtube_handler.go by following compilation errors. More reliable than pre-planning every call site.
