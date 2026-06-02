---
pillar: intuition
title: Auto-Regenerate on Gate Failure Reduces Workflow Friction
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - retry
  - workflow
  - automation
aliases:
  - Automatic Retry on Slop Check Failure
---

Automatically retry content that fails a gate instead of requiring manual action, catching transient errors and reducing workflow friction.

When content fails a slop-check gate, automatically retrigger regeneration instead of waiting for manual user action. This catches transient errors and reduces the friction of the review workflow. The user retains override ability in the Review Bin to manually reject regenerations if needed. Trade-off: automatic retries cost extra compute but improve user experience by reducing manual intervention points.


## Related

- [[Singleton Store Preserves Async Feedback Across Route Navigation]]
- [[Re-Entry Prevention with Active Operation Tracking]]
