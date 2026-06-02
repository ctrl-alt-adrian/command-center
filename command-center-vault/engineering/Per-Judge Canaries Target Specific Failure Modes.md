---
pillar: engineering
title: Per-Judge Canaries Target Specific Failure Modes
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - canaries
  - adversarial-testing
  - eval-robustness
  - judge-eval
---

Design one adversarial canary per judge, targeting that judge's specific weakness, rather than using shared generic canaries.

Each judge in an evaluation pipeline evaluates different properties and fails in different ways. In RoleNext, the optimize-quality judge needed a canary for polished-but-fabricated content, while the gap-analysis judge needed one for hallucinated skills. Rather than a single generic canary, the team designed six (one per judge), each targeting that judge's specific blindness. A shared canary wouldn't test any of them effectively. Per-judge canaries catch the specific ways each judge breaks. One canary per judge is sufficient for a circuit breaker; more canaries add calibration overhead without proportional gain.


## Related

- [[Canary-Driven Verification]]
- [[Adversarial Test Design]]
