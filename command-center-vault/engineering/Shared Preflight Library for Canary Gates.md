---
pillar: engineering
title: Shared Preflight Library for Canary Gates
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - gates
  - infrastructure
---

Extract canary-gate logic to a reusable library function instead of duplicating across scripts.

When multiple test scripts (gap-verify, match-verify, optimize-verify, etc.) all run the same canary checks before proceeding, extract the logic to a shared function. The testing/lib/preflight.sh defines run_preflight "judge-name" with a standard interface. Multi-judge scripts pass space-separated names: run_preflight "match-quality cross-field". Single point of maintenance, consistent gate behavior across scripts, and one place to fix bugs when canary logic changes.


## Related

- [[Confusion Matrix in Calibration Reports]]
