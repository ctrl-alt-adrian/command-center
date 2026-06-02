---
pillar: engineering
title: Separate Raw from Derived Data in API Responses
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - caching
  - data-structure
---

Store both raw and derived data to enable frontend nuance without recomputation.

RoleNext's skill-gap API returns both raw gap scores and impact metadata, not just a final rank. This allows the frontend to show nuance: 'small gap, high impact' reads differently than 'large gap, low priority,' even if both rank identically. Storing both halves also makes the API cacheable and lets clients build downstream logic without recomputation. Cost: larger payloads. Benefit: more expressive product, less frontend recalculation.
