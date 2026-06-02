---
pillar: engineering
title: Per-User Cache Layer Must Invalidate Both Layers or Neither
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - cache-invalidation
  - performance
  - architecture
aliases:
  - dual-layer-cache
  - multi-level-cache-invalidation
---

A per-user cache layer wrapping a global cache requires that invalidation clear both layers simultaneously or risk partial hits and stale data.

RoleNext implemented a two-level caching strategy for video metadata: a per-user cache for frequently-accessed content, backed by a global cache for consistency. The pattern improves read performance significantly. However, cache invalidation becomes critical: if you invalidate only the per-user layer and the global layer remains stale, subsequent requests hit stale data. Conversely, partial invalidation can create divergence between what different users see. The constraint is that after a mutation (like saving a new job that references new video metadata), both layers must be invalidated atomically, or the read must bypass both. This became apparent when job saves were leaving stale metrics in the dashboard because the invalidation logic only cleared one cache layer.
