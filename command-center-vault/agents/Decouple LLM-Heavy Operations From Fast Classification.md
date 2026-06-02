---
pillar: agents
title: Decouple LLM-Heavy Operations From Fast Classification
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - separation-of-concerns
  - scaling
aliases:
  - independent-scaling
---

Keeping refinement (LLM-based) separate from classification (taxonomy-based) allows independent scaling and testing.

We split the system: taxonomy classifier (deterministic, fast) runs inline, but refinement (LLM streaming) lives in a separate endpoint. This decoupling means we can scale or replace the LLM path without touching classification, and test them independently. Pattern: when a workflow has subprocesses with wildly different performance characteristics, decouple them at the API boundary so each can optimize in isolation.


## Related

- [[Taxonomy Classification Before LLM]]
