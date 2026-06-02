---
pillar: engineering
title: Stacked PRs Orphan When Base Merges on GitHub
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - github
  - workflow
  - merge
  - stacked-prs
---

GitHub doesn't retarget stacked PRs when the base PR merges via the UI; the stacked PR's commits orphan and must be cherry-picked onto a fresh branch.

Opened PR #59 stacked on #58 for infrastructure work (2026-04-11). When #58 merged via the GitHub UI, #59's commits orphaned and the PR couldn't be merged. GitHub doesn't automatically retarget stacked PRs to the new base. Workaround: cherry-pick the commits onto a fresh branch and re-open the PR. This is a gotcha if your team uses stacked PRs with the GitHub UI merge flow.
