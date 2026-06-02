---
pillar: engineering
title: Request Ordering Prevents Stale Updates in Rapid Keystroke Sequences
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - race-condition
  - ordering
  - streaming
  - edge-case
---

Rapid typing combined with SSE streaming can cause stale refinements to overwrite newer ones; client-side request ordering prevents this.

When a user types quickly and each keystroke triggers a debounced API call that streams back SSE updates, there's a race: keystroke N+1's response might arrive before keystroke N's completes, causing stale data in the UI. Solution: assign each request a monotonically increasing ID, and have the client only apply updates if the ID is newer than the current state. Simple check, prevents silent data corruption. This edge case only matters when combining keystroke debouncing with streaming responses.


## Related

- [[Debounce Real-Time Suggestions to Reduce Backend Thrashing]]
- [[Stream LLM Reasoning Instead of Waiting for Full Response]]
