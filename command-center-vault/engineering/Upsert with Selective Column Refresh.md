---
pillar: engineering
title: Upsert with Selective Column Refresh
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - postgres
  - upsert
---

ON CONFLICT can refresh only external-source columns while preserving user-edited ones by listing only refresh-targets in DO UPDATE.

When upserting rows where some columns come from external sources (e.g., job scrapers) and others are user-edited, use ON CONFLICT with a selective DO UPDATE clause that only refreshes the external columns. This keeps scraped data in sync without overwriting user edits. Applied in rolenext PR #173 (SaveJob: 14 scrape-sourced columns refreshed on conflict, user columns preserved).
