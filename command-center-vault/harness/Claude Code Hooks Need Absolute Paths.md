---
pillar: harness
title: Claude Code Hooks Need Absolute Paths
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - configuration
  - developer-experience
---

Claude Code hook commands must use absolute paths because the hook runner doesn't execute from the project root.

When registering hooks in settings.json or settings.local.json, always use absolute paths in the command field. The hook runner executes /bin/sh with an unpredictable working directory, so relative paths like '.claude/hooks/formatter.sh' fail with 'No such file or directory'. This was discovered when six hooks simultaneously threw path errors during registration. Convert all references to /home/user/project/.claude/hooks/formatter.sh.


## Related

- [[Hook JSON Schemas Are Event-Type-Specific]]
