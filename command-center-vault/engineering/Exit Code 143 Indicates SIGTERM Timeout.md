---
pillar: engineering
title: Exit Code 143 Indicates SIGTERM Timeout
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - exit-codes
  - debugging
  - signals
---

Exit code 143 = 128 + 15 (SIGTERM). Node's execFile timeout kills child processes.

When the marketing pipeline logged 'Worker hung, terminated after 773m', the exit code was 143, which decodes to SIGTERM (signal 15). This was Node's execFile timeout firing after 180 seconds, not an infrastructure hang. The actual cause was the hook cascade adding latency, not a timeout configuration issue. This is debugging trivia but worth noting: exit codes above 128 are signal deaths (128 + signal number).


## Related

- [[Cascading Hook Failures in Pipeline Automation]]
