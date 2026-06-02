---
pillar: engineering
title: usedForContent Timing Prevents Rediscovery of In-Flight Topics
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - state-management
  - pipelines
  - deduplication
---

Mark KB entries used at generate time, not at review approval, to close the rediscovery gap.

In the KB scanner, mark entries as used when drafts are created (at generate time) rather than when review approves them. This prevents the discover stage from re-scanning entries that already have drafts in the pipeline waiting for review. Without this timing adjustment, each discover run re-evaluates and potentially creates duplicate pipeline tasks for the same topic.


## Related

- [[All Content Paths Must Flow Through the Critical Gate]]
