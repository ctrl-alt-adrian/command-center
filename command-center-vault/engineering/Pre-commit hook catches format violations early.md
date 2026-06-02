---
pillar: engineering
title: Pre-commit hook catches format violations early
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - git-hooks
  - pre-commit
  - automation
  - workflow
aliases:
  - format on commit
  - git hooks
  - lint enforcement
---

Catch linting and formatting issues at commit time with auto-fix, not pre-push.

RoleNext runs `biome check --write --staged` in the pre-commit hook, not pre-push. The --staged flag checks only staged files; --write auto-fixes and re-stages. Cheaper to catch violations at commit than pre-push. The pre-push hook stays for slower checks (tsc and vitest). Prevents format-only commits from accumulating and clouding the diff signal.
