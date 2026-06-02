---
pillar: engineering
title: Client-Side Data Resolution Avoids API Bloat
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - data-fetching
  - queries
aliases:
  - reuse cached queries
  - computed joins client-side
---

When data is already client-side via an independent query, compute derived values on the client instead of duplicating the field in a related endpoint.

TrackerPage already fetches resumes via useQuery(['resumes']). To show resume filename on job cards, RoleNext built a Map<id, filename> from that data and threaded it through components as a prop. This cost zero network traffic and avoided schema changes. The pattern: audit what queries are already running, find what you need, and reduce API surface instead of growing it with JOINs or new fields.


## Related

- [[Parallel data fetching strategies]]
