---
pillar: engineering
title: Spot-Check as Audit Trail
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - audit
  - pipeline
  - validation
aliases:
  - post-run spot-check
  - informational auditing
---

Run spot-check auditing after pipeline completion for observability, not as a blocking gate.

After a pipeline run completes, randomly sample verdicts and re-evaluate them with an adversarial auditor prompt (one that focuses on verifiable factual claims, no WebSearch). This spot-check creates an audit trail and can surface issues, but doesn't block the pipeline. Unlike the 3-stage preflight gates (which must all pass), spot-check is informational. It lets you catch subtle drifts that the simpler gates missed, while keeping the pipeline unblocked. Useful for detecting long-tail cheating strategies that don't show up in your taxonomy.


## Related

- [[Sequential Gate Design Catches Failures at Different Speeds]]
- [[Block-and-Diagnose Over Auto-Remediation]]
