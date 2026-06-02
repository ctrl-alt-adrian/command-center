---
pillar: intuition
title: Client-Side Filtering Empowers Users Over Gatekeeping
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - product-decision
  - filtering
  - user-control
aliases:
  - user empowerment
---

Let users filter their own results instead of hard cutoffs on the server.

RoleNext's first version hard-coded a >= 40% match score filter on the backend. Users couldn't see lower-scoring matches. The fix: remove the server-side filter and move it to the frontend as optional filter pills (All, 40+, 50+, 75+). Users now control their confidence threshold. This surfaces all results and lets users make their own trade-off between precision and recall. It's the difference between the system deciding what matters and letting the user decide.


## Related

- [[Skill-Expanded Search Multiplies Relevant Results]]
