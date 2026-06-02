---
pillar: intuition
title: Stale Task Termination for Explicit User Control
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - resilience
  - user-control
  - design-decision
---

Mark stale running tasks as failed, not pending, so users control retry explicitly.

Marketing-pipeline lowered STALE_TIMEOUT_MS to 6min and changed behavior: stale tasks mark as failed with 'Worker hung, terminated after Xm' error, not pending-retry. This gives users visibility and choice. Logged terminations appear in the error panel, and users can click Rerun All Failed or Rerun per-task. The alternative (auto-retry pending) hides the hang and cascades into more retries if the hang persists. Favor explicit user control over silent automatic retry for failures indicating system problems.
