---
pillar: intuition
title: Trust Source Data Over Custom Enrichment
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - enrichment
  - over-engineering
  - technical-debt
  - architecture
aliases:
  - Know When to Stop Building
  - Source Already Provides It
---

Recognize when a data source already provides structured data and delete unnecessary custom enrichment rather than maintain it.

The RoleNext job-search backend included a 540-line enrichment pipeline that scraped employer websites for job descriptions and salary details. During refactoring, the team discovered jSearch already returned multi-paragraph descriptions, salary ranges, benefits, highlights, and metadata — everything the pipeline extracted. The pipeline added complexity: two new dependencies (goquery, cascadia), a caching layer, retry logic, and I/O overhead that throttled result throughput. Solution: delete it and surface jSearch's native structured data directly. This unblocked a throughput improvement (doubled result count per query) and eliminated code to maintain. Before building enrichment, verify whether the source already provides it.


## Related

- [[Salary Period Inference From Job Description]]
