---
pillar: engineering
title: Dedicated APIs enable clear separation of concerns in analytics features
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - separation-of-concerns
  - endpoints
  - architecture
---

Create a dedicated endpoint for new analytics features rather than extending existing ones.

RoleNext could have extended the job search API to include search history. Instead, the team created a separate search-history endpoint. This decision isolated concerns: the search endpoint stays focused on finding jobs, while the history endpoint owns trend aggregation and time-series queries. The history data could use different caching and pagination strategies without complicating search logic. This separation also made it easier to iterate on the analytics layer independently.
