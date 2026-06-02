---
pillar: engineering
title: Stable Proxies for Unstable Concepts
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - data-design
  - pragmatism
  - signal-hierarchy
---

Use stable, computable proxies for concepts that shift meaning over time.

Retrieval bucket (how relevant was this job to the search keyword) is time-bound: it means something at search time, nothing after save. Storing it is nonsensical. Instead, default to relevant for all saved jobs (users saved it, so they found it relevant). This trades precision for simplicity. Other signals (match score, gap severity) still drive prioritization. Useful pattern: when a field's meaning is context-dependent, find a stable proxy rather than trying to preserve unstable context.


## Related

- [[Entries Table and Full Reaggregation]]
