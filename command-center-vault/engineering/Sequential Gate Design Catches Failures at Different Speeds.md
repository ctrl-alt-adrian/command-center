---
pillar: engineering
title: Sequential Gate Design Catches Failures at Different Speeds
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - pipeline
  - defense
  - latency
aliases:
  - staged preflight
  - tiered validation
---

Chain validation stages by detection cost: fast canaries fail quick, slow expensive checks run only if cheap ones pass.

In the anti-gaming guards for LLM-as-Judge pipelines, a 3-stage gate runs canary evaluation (detects catastrophic breakage), drift-check against historical baseline (detects slow leniency creep), then held-out validation (detects overfitting). Each stage catches different failure modes and has different costs. Canaries are cheap and fast (block immediately on failure). Drift requires querying history but not re-evaluation. Held-out is expensive (requires running the judge on fresh examples). By ordering them cheapest-first, you fail fast without burning tokens on later stages if early checks already failed.


## Related

- [[Append-Only JSONL for Drift History]]
- [[Block-and-Diagnose Over Auto-Remediation]]
