---
pillar: engineering
title: Prioritize Cache Lookup Before Fallback Chains
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - performance
  - resolver-chains
  - latency
aliases:
  - cache-first strategy
---

Check cache before attempting expensive fallback chains to avoid redundant work.

Mirukai's playback detail page was running the full resolver chain (HTTP requests to multiple scrapers) even for recently watched episodes. Adding a cache lookup before the resolver chain eliminated the latency. For an episode watched three days ago, the cache returns the episode list and stream URLs instantly, and the resolver chain is never invoked. Pattern: when you have both fast lookups and slower fallback paths, always check the fast path first.
