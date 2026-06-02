---
pillar: intuition
title: Accept Merge Conflicts from Parallel PRs When Resolution Is Trivial
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - merge-conflicts
  - parallel-work
  - tradeoffs
---

When two parallel PRs both modify the same file in ways that are easy to combine, accept the merge conflict rather than forcing sequential ordering.

PRs #200 (DB SSL enforcement) and #201 (migration guard) both added parameters to db.Open(). This guaranteed a merge conflict, but both changes were independent and trivial to combine: just add both parameter assignments. Rather than force one PR to wait for the other, we accepted the conflict and rebased. This kept the parallel execution pattern simple and maintained independent reviewability. The cost (15 minutes to rebase and force-push) was lower than the benefit of not serializing work.


## Related

- [[Separate PRs per Production Behavior]]
