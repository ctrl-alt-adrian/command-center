---
pillar: engineering
title: 'No Stacked PRs: Merge Dependencies Downward'
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - workflow
  - git
  - dependencies
---

Avoid stacking PRs. When PR 2 depends on PR 1, merge PR 1 into PR 2's branch instead.

When PR 2 depends on code from PR 1 (context propagation must land first), don't stack PR 2 on top. Have both target main. Implement by merging PR 1 into the PR 2 branch before pushing. PR 1 lands, then PR 2 merges cleanly without the risk of stacked-PR complications.
