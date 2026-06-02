---
pillar: engineering
title: Composite Scraper Abstracts Multi-platform Orchestration
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - scraping
  - composition
  - coupling
aliases:
  - composite pattern
  - platform abstraction
---

Single scraper interface that internally orchestrates multiple platforms reduces coupling and keeps handler code focused on behavior, not platform selection.

Integrating three ATS platforms could mean branching logic at every call site or handlers managing multiple client calls. Instead, use a composite scraper: a single interface that internally routes to the appropriate platform scraper and unifies the response. New ATS sources can be added without changing downstream handler code. This pattern clarifies where platform-specific logic lives, inside the scraper, rather than scattered across consumers.
