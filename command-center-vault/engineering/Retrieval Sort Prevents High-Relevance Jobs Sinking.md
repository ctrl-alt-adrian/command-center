---
pillar: engineering
title: Retrieval Sort Prevents High-Relevance Jobs Sinking
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - ranking
  - sorting
  - pipeline
aliases:
  - relevance-first ranking
---

Sort job results by retrieval score immediately after filtering, before LLM fan-out. This ensures top-relevance matches rank high even if downstream analysis is slow.

In a pipeline where retrieval score is fast but LLM analysis per job is slow, deferring the sort until after LLM dispatch means fast-retrieved, high-relevance jobs wait behind slow jobs. Fix: sort by retrieval score (stable, preserving scraper order for ties) immediately after the retrieval filter, before per-job LLM dispatch. Top matches now rank high regardless of LLM latency variance. Extraction of the sort comparator into a separate testable function (`sortJobsByRetrievalScoreDesc`) makes the ordering guarantee explicit.


## Related

- [[Parallel Stage 1 Extraction Shortens Critical Path]]
- [[Match-Score Primary Flip Exposes Tie-Breaking Gap]]
