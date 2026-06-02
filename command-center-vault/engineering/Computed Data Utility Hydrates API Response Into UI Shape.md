---
pillar: engineering
title: Computed Data Utility Hydrates API Response Into UI Shape
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - data-layer
  - frontend-patterns
  - computed-state
aliases:
  - data transformation layer
  - UI state computation
---

Create a single computeDashboardData function that transforms flat API responses into hierarchical UI state, letting components focus on rendering, not data massage.

The dashboard implementation separates data shape from rendering: computeDashboardData takes the backend response and returns UI-ready structure (pipelines grouped by stage, stats computed from trends, rows keyed for lookup). This layer owns all formatting (relative dates, score binning), derivations (trend direction, pipeline oldestAge), and reference construction (search hrefs). Components then just render the prepared data without conditional logic. Tested with 30 tests covering zero states, partial trends, score tone boundaries (54/55/74/75), and edge cases. This pattern works because the data transformation is stable while the UI representation will change; separating them lets you redesign components or add new stats without touching the API contract.


## Related

- [[Lock Design Workflow After First Successful Handoff]]
- [[Relative Date Helper With Multiple Scales]]
