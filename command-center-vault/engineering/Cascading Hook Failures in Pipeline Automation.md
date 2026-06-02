---
pillar: engineering
title: Cascading Hook Failures in Pipeline Automation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - claude-code
  - hooks
  - pipeline
  - automation
  - subprocess
aliases:
  - hook cascade
  - child process hooks
---

Child Claude processes triggered parent SessionEnd hooks, cascading failures through the pipeline. Fix: scope settings to project-level only.

When a parent Claude Code process spawns child processes (e.g., workers generating content in parallel), each child's SessionEnd hook fires at completion. This triggered the parent's global SessionEnd hook, which spawned diagnostic calls. These nested invocations added latency that pushed operations past timeout limits, causing the parent to exit with 143 (SIGTERM). The fix: add `--setting-sources project` to all child Claude invocations. This flag scopes hooks and settings to project-level only, preventing child process state from triggering parent hooks. Applied to the marketing pipeline workers in dashboard/src/lib/claude.ts. The pattern applies anywhere child processes are spawned inside an automation harness.


## Related

- [[Promise.allSettled for Resilient Parallel Operations]]
- [[Retry Amplification in Pipeline Automation]]
