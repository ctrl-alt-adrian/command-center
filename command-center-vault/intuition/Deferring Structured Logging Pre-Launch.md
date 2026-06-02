---
pillar: intuition
title: Deferring Structured Logging Pre-Launch
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - shipping
  - scope-deferral
  - pre-launch-judgment
aliases:
  - defer-scale-features
---

Skip structured JSON logging (slog) before launch even though it was planned, accepting current log.Printf with prefix style because the feature's value scales with log volume RoleNext doesn't yet have.

Slog adds genuine value for log aggregation at scale, but RoleNext isn't processing enough logs to need it yet. Implementing it would touch 20+ files across both services — high effort, low pre-launch value. The existing log.Printf with [prefix] style works fine. Deferred this PR as the only 'Large' effort follow-up. This is a judgment call: engineer features when they're needed, not when they *could* be useful. Pre-launch is the time to defer post-launch conveniences.
