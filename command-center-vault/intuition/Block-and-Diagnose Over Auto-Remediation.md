---
pillar: intuition
title: Block-and-Diagnose Over Auto-Remediation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - pipeline
  - human-judgment
aliases:
  - fail-fast-with-diagnostics
  - manual-fix-requirement
---

When a gate fails, block the pipeline and surface diagnostics. Don't auto-remediate; fixing requires understanding why it broke.

The impulse is to auto-fix failed guards (revert to last known-good judge, re-tune, retry). Instead, block the pipeline and emit detailed diagnostics. Why? Auto-remediation without version-controlled judge prompts means you can't safely roll back. More importantly, the failure tells you something. If held-out validation fails, the judge is overfitting. If drift check fails, something changed in the data or evaluation criteria. Auto-fix masks the root cause. Better to make the developer understand and fix it manually. This requires disciplined diagnostic output (confusion matrices, before-after diffs, concrete failure examples).


## Related

- [[Append-Only JSONL for Drift History]]
- [[Taxonomy-Driven Test Case Design for LLM Drift]]
