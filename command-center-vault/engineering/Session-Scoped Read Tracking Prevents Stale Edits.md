---
pillar: engineering
title: Session-Scoped Read Tracking Prevents Stale Edits
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - read-before-write
  - sessions
---

Use a session-ID-keyed tracking file to enforce read-before-write, resetting on each new session.

Implement read-before-write as a session-scoped check: track file reads to `/tmp/claude-reads-<session_id>` and hard-block Edit calls on files not yet read in the current session. Session-ID keying forces a fresh read each time a new session starts, preventing stale edits to files that changed since the last session. Per-project tracking would allow edits without re-reading, defeating the purpose. This balances one-read-per-session with repeated edits to the same file within a session.


## Related

- [[Mechanical Enforcement for Forgotten Code Quality Rules]]
