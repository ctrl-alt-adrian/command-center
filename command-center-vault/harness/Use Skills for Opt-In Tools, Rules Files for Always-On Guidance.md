---
pillar: harness
title: Use Skills for Opt-In Tools, Rules Files for Always-On Guidance
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - skills
  - invocation-overhead
  - cognitive-load
---

Avoid creating multiple skills for one domain because remembering to invoke each adds friction. Rules files with globs auto-activate instead.

Considered splitting Go guidance into 3-4 skills (go-review, go-write, go-test) to match workflow stages. Rejected: users have to remember which skill to invoke at each step, consistency breaks if they forget, and it fragments guidance. Rules files activate automatically, ensuring coverage without user remembrance overhead.


## Related

- [[Scoped Rules with Globs Load Only When Relevant]]
