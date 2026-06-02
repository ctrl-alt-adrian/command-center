---
pillar: engineering
title: Claude Code Environment Variables Leak to Child Processes
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - process-management
  - environment
  - harness
---

CLAUDECODE and CLAUDE_CODE_ENTRYPOINT are inherited by child processes and can cause nested-session conflicts.

When running inside Claude Code, the environment sets CLAUDECODE=1 and CLAUDE_CODE_ENTRYPOINT=cli. If you spawn child processes via execFile without explicitly filtering the environment, these variables get inherited and can cause unexpected behavior in nested CLI calls. Stripping them from the child process environment prevents conflicts and unexpected state propagation.
