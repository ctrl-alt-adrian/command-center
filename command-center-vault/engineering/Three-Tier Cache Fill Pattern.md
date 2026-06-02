---
pillar: engineering
title: Three-Tier Cache Fill Pattern
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - performance
  - fallback-strategy
aliases:
  - Layered cache fill
  - User to global to async
---

Check user cache, fall back to global cache, queue async fetch—minimizing redundant work while keeping data fresh.

The PopulateUserVideos function in rolenext follows a three-tier pattern: (1) if a valid entry exists in the user-specific cache (user_skill_videos), return it immediately; (2) if not, copy results from the global cache (youtube_cache) as a warm-start seed for the user's cache (avoids redundant YouTube API calls); (3) if neither cache has data, enqueue an async fetch job. This pattern ensures that subsequent queries for the same user-skill pair hit the user cache (via COALESCE at query time), while new requests are fulfilled from whatever source is available without redundant API calls. The composite key (user_id, skill) ensures each tier operates at the right scope.


## Related

- [[Per-User Cache Layer Decoupling for Personalization]]
