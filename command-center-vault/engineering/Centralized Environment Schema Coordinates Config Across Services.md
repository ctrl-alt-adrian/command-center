---
pillar: engineering
title: Centralized Environment Schema Coordinates Config Across Services
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - configuration
  - coordination
  - monorepo
---

Document environment variables once in specs/ and link all .env.example files to it, preventing config parameter drift across services.

RoleNext had three separate services, each with its own .env.example. This created quiet divergence: one service added a new config parameter without telling the others, leading to inconsistent deployments. Centralizing the environment schema in specs/environment.md and making all .env.example files reference it created a single source of truth. This prevents drift and clarifies onboarding.
