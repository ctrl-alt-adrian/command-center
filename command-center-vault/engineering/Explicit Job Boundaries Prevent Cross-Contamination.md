---
pillar: engineering
title: Explicit Job Boundaries Prevent Cross-Contamination
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - prompt-tuning
  - multi-record-analysis
  - context-boundaries
aliases:
  - header-markers-isolate-records
---

When analyzing multiple records in one context, explicit boundary markers prevent context leakage.

During analyzer tuning for RoleNext, the model leaked context between adjacent job descriptions — it flagged skills as missing based on requirements from a different job. Fix: replaced implicit separation with explicit boundary markers: 'use only the text between this job's JOB N header and the next job header.' Simple, but the model followed the instruction strictly. Pattern: when feeding batches of structured records to an LLM, mark the boundaries clearly. Markers act as anchors for the model's isolation logic.


## Related

- [[Steering Over Constraining]]
