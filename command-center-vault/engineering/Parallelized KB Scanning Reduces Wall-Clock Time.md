---
pillar: engineering
title: Parallelized KB Scanning Reduces Wall-Clock Time
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - parallelization
  - model-selection
  - performance
  - kb-scanning
---

Replace mega-prompts with parallel per-entry calls to slash wall-clock time and isolate failures.

The original KB scanner sent all entries (295KB, 21 entries) in a single Sonnet prompt. Switching to per-entry Haiku calls (each 2KB) parallelized the evaluation and reduced wall-clock time from 2-3 minutes to 15 seconds. Individual failures don't block others, and Haiku is sufficient for the yes/no content-worthiness decision. The wall-clock problem was not model capability or prompt truncation but cumulative latency; parallelizing with a cheaper model solved it.


## Related

- [[Model Tiering by Content Length]]
