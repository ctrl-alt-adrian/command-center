---
pillar: engineering
title: Explicit Blocking Markers on Checklists Clarify Dependency Status
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - project-management
  - checklists
  - blocking
  - pre-launch
---

Checklists benefit from explicit markers like `[BLOCKED: env]` to distinguish 'not started' from 'waiting on dependency'.

During rolenext pre-launch checklist annotation, seven items were marked `[BLOCKED: env]` with a top-of-file blockquote explaining the marker. This makes it clear that these items are ready to start but are waiting on environment support work to finish. Without explicit markers, a reviewer might interpret a blank item as forgotten work rather than intentional deferral.


## Related

- [[Environment Support Is a Pre-Launch Gate, Not Post-Ship Polish]]
