---
pillar: harness
title: SessionEnd Hook Cascade in Subprocess Spawning
tier: 3
content_ready: false
created: '2026-05-14'
tags:
  - hooks
  - subprocess
  - gotcha
---

Spawned subprocesses trigger SessionEnd hooks, which can trigger additional subprocesses, causing cascading cancellations.

Marketing-pipeline spawns claude calls for each platform (claude -p --model sonnet). Each spawned session triggers the user's global SessionEnd hook (end-session.sh --git), which itself calls claude -p. The hook runner times out trying to wait for the cascade. This stayed invisible for weeks because errors were silently caught. Fix: pass --setting-sources project to claude.ts to exclude global hooks in subprocesses. Implementation documented in HANDOFF-hook-fix.md. When spawning subprocesses, isolate their hook scope.
