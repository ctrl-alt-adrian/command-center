---
pillar: engineering
title: Binary vs. Semantic Rules Partition
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - rules
  - hooks
  - design
---

Anything with a yes-or-no check becomes a hook; semantic judgment stays as rules.

Split code quality into two categories. Hooks: file read? debug statement present? file too long? build passes? These have clear binary answers and become shell script hooks. Rules: is the function doing one thing? Is the name descriptive? Should this be a shared component? These require semantic judgment and stay as prose guidelines. This partition acknowledges what scripts can check mechanically vs. what requires human judgment.


## Related

- [[Mechanical Enforcement for Forgotten Code Quality Rules]]
