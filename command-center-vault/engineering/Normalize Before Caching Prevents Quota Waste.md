---
pillar: engineering
title: Normalize Before Caching Prevents Quota Waste
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - normalization
  - dependencies
---

Normalize data before caching to avoid duplicate entries for semantic equivalents.

Without normalization, skill variants (Kubernetes, k8s, kubernetes) create separate cache entries, wasting quota on duplicates. Normalize to canonical form before any caching layer. Sequencing matters: build normalization as a prerequisite, not an afterthought. Applied in RoleNext: skill normalization completed before YouTube API integration so cache entries cluster by semantic skill, not surface-form variants.


## Related

- [[Canonical vs Display-Name Separation]]
