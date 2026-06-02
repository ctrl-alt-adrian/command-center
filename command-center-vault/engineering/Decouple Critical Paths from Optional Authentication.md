---
pillar: engineering
title: Decouple Critical Paths from Optional Authentication
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - resilience
  - dependencies
  - gates
---

Make features available even when optional third-party services are unavailable by identifying what they truly require.

RoleNext's feedback endpoint was originally blocked by GITHUB_PAT being set, because feedback went directly into GitHub Issues. After moving feedback to PostgreSQL, feedback became available even if GitHub is down or credentials are missing. Bug reports still require the GitHub token because they depend on the GitHub API. The pattern: identify what your feature actually needs (database, not GitHub) and gate only on that. Optional integrations should not block core functionality.
