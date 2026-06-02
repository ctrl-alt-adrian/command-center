---
pillar: engineering
title: Wire Cache Cleanup to Shutdown Signal
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - go
  - cleanup
  - cache
  - lifecycle
  - signal-handling
---

Hook cache cleanup into graceful shutdown so expired entries don't accumulate across deployments.

Added CleanExpiredCache to RoleNext's backend to delete expired entries from search_cache, job_cache, and youtube_cache. Wired it to the root context signal (via signal.NotifyContext) so it runs during graceful shutdown. The cleanup attempts all three tables even if one fails, capturing the first error. This keeps the cache lean without needing a separate cron job.
