---
pillar: engineering
title: All Content Paths Must Flow Through the Critical Gate
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - pipeline
  - enforcement
  - architecture
---

Remove all bypass routes to make the mandatory validation structural rather than policy-based.

When you have a mandatory validation stage, remove all code paths that bypass it. In this project, the regenerate and refine endpoints originally called Claude directly and skipped slop-check. Moving all content generation into the pipeline (via generate tasks) and running checkSlop on all output enforced the gate universally. Endpoints that would previously bypass become pipeline creators instead of direct code paths, making the invariant structural rather than policy-based and impossible to accidentally circumvent.


## Related

- [[Reject as State Transition That Kills the Topic]]
