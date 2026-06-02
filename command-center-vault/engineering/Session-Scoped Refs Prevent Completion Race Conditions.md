---
pillar: engineering
title: Session-Scoped Refs Prevent Completion Race Conditions
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - race-conditions
  - mutations
  - async
  - stateful-flows
aliases:
  - completion tracking ref
  - mutation safety
---

Track completed items in a Set ref scoped to the current session to eliminate timing-dependent retry bugs.

In the onboarding tutorial, mutations could fire multiple times if async state transitions overlapped, restarting a completed tutorial. Instead of relying on async state alone, a completedThisSession Set ref (checked in the start guard, updated after finish) made the logic timing-independent. The tutorial checks the ref first; if the screen is in the Set, it rejects the restart. This pattern eliminates entire categories of race conditions for stateful flows where replaying an action is harmful.


## Related

- [[Distinguish Loading State From Data Readiness]]
