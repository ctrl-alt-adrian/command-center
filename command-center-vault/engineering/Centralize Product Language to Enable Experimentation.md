---
pillar: engineering
title: Centralize Product Language to Enable Experimentation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - configuration
  - testing
  - product-language
  - maintainability
aliases:
  - terminology configuration
  - language as config
---

Instead of hardcoding product terminology across components, centralize it in a single configuration module to enable future A/B testing and term variants.

RoleNext created a dedicated `terminology.ts` module as the single source of truth for product language rather than spreading different phrasings across components. This enables future experimentation: you can A/B test different occupation-aware phrasings without touching component code. The same pattern works for any multi-tenant or personalized product where language might vary by segment or user cohort. Configuration beats hardcoding when the strings themselves are tuning parameters.


## Related

- [[Single Source of Truth]]
- [[Feature Flags and Configuration]]
