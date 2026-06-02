---
pillar: intuition
title: Data-Driven Parsing Over Blind Heuristic Tuning
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scraping
  - parsing
  - judgment
  - iteration
---

Different job board sources have inconsistent description patterns. Gather data on what breaks before tweaking heuristics, rather than changing parsing rules blind.

RoleNext's job description parser uses heuristics like 'lines ending with a colon are section headers.' During bug fixes, it looked like some lines were incorrectly parsed as headers. But investigation showed the real problem was missing sections on some sources—the heuristic wasn't broken, the data was just inconsistent. Rather than tweak the rule, the decision was to gather more data on how different job boards format descriptions before changing the parsing logic. This avoids regressing one source while trying to fix another. Data first, heuristics second.
