---
pillar: engineering
title: Worker-Level Timeouts as Safety Net for Stage-Bounded Work
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - timeouts
  - resilience
  - stages
---

Wrap worker stages in timeouts bounded to stage-specific budgets; each retry attempt gets individually wrapped.

Marketing-pipeline added withTimeout() helper with per-stage budgets: discover=5min, generate=4min, slop-check=30s. Each runWithRetry attempt is individually wrapped. This catches two failure classes: (1) Claude CLI hangs despite execFile timeout (rare but happens), and (2) non-CLI hangs like stalled network calls. With this safety net, a hung stage fails and surfaces as a worker-retry error within seconds, not minutes. Define stage budgets based on expected runtime plus 20% headroom.
