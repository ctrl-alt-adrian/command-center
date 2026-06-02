---
pillar: intuition
title: When a Gate Tool Breaks, Ask If You're Solving It Elsewhere
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gating
  - security
  - dependabot
  - ci
---

Don't default to replacing a broken gate tool. Check if a better solution already exists.

npm retired the pnpm audit endpoint (410 Gone). The team could have replaced it with osv-scanner or audit-ci, but instead removed the CI gate entirely. Dependabot already provides better coverage through continuous alerts and automated fix PRs. A point-in-time CI check can't compete with continuous monitoring that runs across the whole dependency tree. The judgment: when a gating tool breaks, ask if you're already solving that problem better elsewhere.
