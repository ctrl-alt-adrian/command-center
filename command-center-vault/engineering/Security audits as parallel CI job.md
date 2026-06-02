---
pillar: engineering
title: Security audits as parallel CI job
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - ci
  - security
  - audit
  - parallelization
aliases:
  - security audit
  - CI security
  - audit job
---

Run security audits in a separate CI job to avoid masking test failures.

RoleNext runs `pnpm audit --prod` and `go mod verify` in a parallel security job, not inline with frontend/backend test pipelines. Allows all three to run concurrently; a security advisory failure doesn't suppress test results. Initially designed non-blocking (continue-on-error), but blocking audit failures was preferred without losing visibility into test status. Separates concerns: audits and tests report independently.
