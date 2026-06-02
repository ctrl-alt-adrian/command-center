---
pillar: engineering
title: Resume Search Verification Prevents Hallucinated Gaps
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - prompt-tuning
  - hallucination-prevention
  - verification
aliases:
  - explicit-search-vs-inference
---

Requiring explicit text search before flagging a missing skill eliminates hallucinated gaps.

In RoleNext gap analysis, the model would sometimes acknowledge a skill was on the resume but flag it as missing anyway. Added instruction: 'For each candidate skill, search the resume text for the skill name, common abbreviations, and related terms. Only emit the skill if you confirm zero matches.' Forces the model to perform a concrete operation before judgment. This reduced ACLS (acknowledged-but-contradicted list) errors and improved specificity. The instruction maps to how an engineer would actually verify the claim.


## Related

- [[Binary Criteria Over Scored Rubrics]]
