---
pillar: engineering
title: Stacked PRs Must Target Main, Never Feature Branches
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - git-workflow
  - stacked-prs
  - github
---

When stacking PRs, always use --base main. Using --base on a feature branch strands commits on orphaned branches when the base PR merges first.

Hard rule learned from PR #59 getting lost: never open a stacked PR with --base pointing to another feature branch. Always use --base main. When the base PR merges first under GitHub's standard merge flow, the feature branch is deleted and commits stacked on top get stranded. The only safe pattern is linear: each PR targets main, lands, then the next PR stacks on the new main. This is specific to GitHub's UI merge behavior. Other workflows (rebase, squash-and-rebase) have different gotchas.
