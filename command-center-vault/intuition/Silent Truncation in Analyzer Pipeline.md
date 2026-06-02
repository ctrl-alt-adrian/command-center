---
pillar: intuition
title: Silent Truncation in Analyzer Pipeline
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - analyzer
  - silent-failures
  - limits
  - debugging
  - data-loss
aliases:
  - Hardcoded Limits Hide Data Loss
  - Token Ceiling Hides in Plain Sight
---

Hardcoded limits that silently drop data are invisible failures. The RoleNext analyzer had a `jdMaxTokens=2048` ceiling that truncated job descriptions without error signals until adding a new data source exposed the problem.

The RoleNext analyzer had a hardcoded 2048-token ceiling on job descriptions. When analyzing a large job posting, the system would truncate it silently and proceed without error, log, or alert. The truncation meant the LLM was analyzing incomplete context, producing inaccurate results. This went unnoticed until direct ATS scrapers (which pull longer job descriptions from provider APIs) started exposing the problem: results were missing or shallow. The fix: make token limits configurable per plan, log when truncation occurs, and add explicit tests that verify no truncation happens in normal usage. Any hardcoded limit that affects data quality needs both visibility (logging when triggered) and configurability (so different tiers can have different budgets).


## Related

- [[Token Budget Scaling with Job Count]]
- [[Flexible JSON Unmarshaling for LLM Provider Variance]]
