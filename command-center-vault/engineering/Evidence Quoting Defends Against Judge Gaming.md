---
pillar: engineering
title: Evidence Quoting Defends Against Judge Gaming
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - judge-eval
  - gaming-defense
  - mechanically-verifiable
  - llm-evaluation
---

Require judges to cite exact source lines for every claim, preventing vibes-checking and forcing mechanical verifiability.

In RoleNext's LLM-as-judge evaluation pipeline, the biggest attack vector was judges scoring without examining the source material. The fix: require every claim to include an exact citation (line number, exact text) or explicitly state NO SOURCE FOUND. This produces a structured evidence map that can be spot-checked by humans or scripts. The judge still performs the evaluation, but now it's mechanically verifiable. You can't score a candidate 8/10 on truthfulness if you can't point to the evidence you actually checked. This pattern generalizes to any evaluation system where the judge's reasoning needs to be auditable.


## Related

- [[Mechanically Verifiable Metrics]]
- [[Judge Output Validation]]
