---
pillar: engineering
title: Multi-stage Title Normalization for Cross-platform Matching
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - text-processing
  - semantic-matching
  - job-search
  - ats
aliases:
  - ATS title matching
---

Three-stage pipeline of tokenization, stopword removal, and synonym expansion handles semantic job title variation across different ATS platforms.

Job boards like Greenhouse, Ashby, and Lever use different title conventions. Simple string matching fails because "VP Engineering" and "Vice President of Software Development" are semantically equivalent but lexically distinct. The rolenext scrapers use a three-stage pipeline: tokenize titles into components, remove stopwords and domain-specific noise, then apply synonym mapping (Engineer=Developer=Programmer). Stopword filtering alone is insufficient because many genuine domain words resemble stopwords. This approach allows cross-platform title matching without false positives.
