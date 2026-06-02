---
pillar: engineering
title: Distinguish Loading State From Data Readiness
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - async
  - react-query
  - race-conditions
  - guards
aliases:
  - isReady pattern
  - async data guard
---

Check for both !isLoading and !!data instead of just !isLoading to avoid premature logic evaluation in async flows.

In the RoleNext onboarding tutorial, guards like isScreenDone were evaluating before async data arrived, causing tutorials to fail on page refresh. The issue: isLoading becomes false when the query starts, even if data hasn't populated yet. The fix was deriving an isReady flag that checks both, preventing guards from entering business logic until data actually exists. Apply this anywhere you have dependent state that shouldn't execute until async work is complete.


## Related

- [[Session-Scoped Completion Tracking]]
