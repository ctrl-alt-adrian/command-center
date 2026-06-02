---
pillar: engineering
title: execFile Error Objects Require Explicit Field Extraction
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - error-handling
  - debugging
  - process-management
---

Default error.message discards stderr and exit codes; extract structured fields for actionable diagnostics.

Node.js execFile error objects contain stderr, exit code, signal, and killed flag, but the default error.message only contains the command string. In the Claude CLI wrapper, this produced blind error reports like 'Command failed: claude -p --model X' with no actionable details. Structuring error handling to extract and surface .stderr, .code, .signal, and .killed immediately revealed that timeouts were SIGTERM (exit 143 = 128+15) from Node.js process termination, not Claude API errors.
