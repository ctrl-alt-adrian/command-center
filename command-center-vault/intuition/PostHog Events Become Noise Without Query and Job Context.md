---
pillar: intuition
title: PostHog Events Become Noise Without Query and Job Context
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - analytics
  - instrumentation
  - context
aliases:
  - event carryover
  - contextual events
---

A `job_save` event fired when a user saves a job is useless for funnels without knowing which search query and which job ID led to the save.

Analytics events must carry enough context to be actionable. A bare `job_save` event tells you a job was saved but not which search brought the user to it or which job. Result: you can't build a funnel from search → view → save or measure which queries generate saves. Fix: attach `search_query`, `job_id`, and `match_score` to the event payload. Alternatively, store them in session state that the analytics layer reads. The first-touch attribution pattern (sessionStorage for UTM) is one instance of this: context must travel with the event or persist in a place the event handler can read.


## Related

- [[Session Storage Preserves First-Touch Attribution Without Cross-Tab Pollution]]
