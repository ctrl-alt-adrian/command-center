---
pillar: engineering
title: SQLite for User-Resumable Features
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - caching
  - persistence
  - sqlite
  - app-lifecycle
aliases:
  - persistent cache
  - cross-session state
---

For features where users resume work across app restarts, SQLite persistence beats in-memory cache.

Mirukai's anime streaming app initially cached episode lists and stream URLs in memory. When users closed and reopened the app, cold-start playback latency returned. Moving the cache to SQLite eliminated the problem: a user who paused an episode could resume it days later without replaying the resolver chain. In-memory cache is fast but disappears on restart. SQLite is slightly slower but persists across app lifecycle. Pick SQLite for any feature where resumption across app restarts is the common case.
