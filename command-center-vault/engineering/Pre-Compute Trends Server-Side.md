---
pillar: engineering
title: Pre-Compute Trends Server-Side
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - performance
  - backend
---

Calculate trend aggregates on the backend to reduce payload and client-side filtering complexity.

Rather than shipping raw time-series data to the client for filtering and aggregation, compute trends server-side. Reduces API payload, eliminates client-side calculation logic, and makes queries clearer. The backend trends endpoint in RoleNext aggregates skill gap progression, then the dashboard receives just the summary (trend line points, delta percentage) needed for display. Simpler for both layers.
