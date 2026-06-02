---
pillar: intuition
title: Match-Score Primary Flip Exposes Homogeneous-Score Tie-Breaking Gap
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - ranking
  - ux
  - sort-order
aliases:
  - tie-breaking visibility
---

When match scores cluster (many jobs at 85%), the primary sort becomes less relevant and secondary sort (scraper order, posted date) becomes visible to users.

In job search, flipping sort from retrieval-score-only to match-score-primary revealed a UX gap: when multiple jobs have the same or very close match scores (common at 85%+), job order becomes essentially random—whatever the scraper order was. Users see this as unpredictable ranking. Unlike retrieval score (which has a wide spread), match scores cluster because pillar classification is coarse. Secondary sort becomes critical and user-facing. Decision: keep match-score primary, but add a clear secondary sort (e.g., posted date, salary range) so users understand why jobs with the same match score appear in a particular order.


## Related

- [[Retrieval Sort Prevents High-Relevance Burial]]
