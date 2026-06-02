---
pillar: intuition
title: Severity Classification Over Binary Detection
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - classification
  - severity
  - product-design
---

Classify gaps into hard_blocker, soft_blocker, and weakly_evidenced categories rather than binary yes/no.

Binary detection flattens signal. Three-tier severity classification gives users actionable priority: hard blockers block job eligibility, soft blockers mean weakness in an area, weakly evidenced gaps might not be real. Combine this with user overrides so the system is honest about uncertainty. Developers then see not just what gaps exist but which ones matter most. Pattern generalizes beyond skill gaps to test coverage, code quality, incident severity, or any signal with fuzzy boundaries.


## Related

- [[User Overrides Surface System Limits]]
- [[Impact-Weighted Aggregation Over Frequency Ranking]]
