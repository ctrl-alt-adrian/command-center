---
pillar: engineering
title: Composite Scraper with Primary/Secondary Semantics
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scraper-architecture
  - data-sources
  - resilience
  - orchestration
  - fail-soft
aliases:
  - Primary/Secondary Data Sources
  - Fail-Soft Source Composition
---

Combine multiple data sources with explicit fail-fast/fail-soft semantics: primary source errors fail the request; secondary source errors are logged and skipped. This adds coverage without risking silent degradation.

RoleNext combined JSearch (primary: semantic keyword matching, broader coverage) with direct ATS scrapers (secondary: structured, fresh, free). Both run in parallel; results are merged with primary winning on duplicates (deduped by URL). If JSearch fails, the request fails. If an ATS provider has issues, that failure is logged but the request succeeds with whatever results remain. This pattern works because the primary source is reliable enough to be a backstop, and the secondary source adds value without being essential. The key is explicit fail semantics — document which sources must succeed and which are best-effort. This prevents the common failure mode where adding a new data source silently degrades quality if that source breaks.


## Related

- [[In-Process Board Cache with Bounded Concurrency]]
