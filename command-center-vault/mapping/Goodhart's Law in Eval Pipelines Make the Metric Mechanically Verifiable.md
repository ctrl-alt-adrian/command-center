---
pillar: mapping
title: 'Goodhart''s Law in Eval Pipelines: Make the Metric Mechanically Verifiable'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - goodharts-law
  - metric-gaming
  - eval-pipeline
  - measurement
---

When optimizing for a metric, the metric breaks unless the underlying mechanism is mechanically verifiable; require evidence, not just scores.

Goodhart's Law states that when a measure becomes a target, it ceases to be a good measure. In evaluation pipelines, the measure is the judge's score. Teams optimize for higher scores; the judge breaks. The temptation is to add more metrics or stricter thresholds, but that's playing meta-games with a broken metric. The actual fix is to make the underlying mechanism mechanically verifiable. In RoleNext, this meant evidence quoting (so you can audit the judge's reasoning), per-judge canaries (so you catch specific failure modes), and score distribution monitoring (so you spot drift). Without mechanical verifiability, you're just adding complexity to a fundamentally gameable system.


## Related

- [[Metric Drift Detection]]
- [[Optimization Pathways]]
