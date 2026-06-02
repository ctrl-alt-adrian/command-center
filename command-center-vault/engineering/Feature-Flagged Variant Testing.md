---
pillar: engineering
title: Feature-Flagged Variant Testing
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pipeline
  - testing
  - rolenext
  - deployment
---

Keep legacy code alongside new implementation via feature flag; enables side-by-side comparison and quick rollback without code deletion.

RoleNext's v2 pipeline is gated behind a HIRELENS_PIPELINE_VERSION env var, allowing both v1 and v2 to run on the same inputs for direct score comparison. Legacy code remains undeleted and deployable. This pattern is valuable when the old and new approaches solve the same problem differently and regression risk is real. The overhead is modest: a routing decision at the entry point. Trade-off: the codebase carries both versions indefinitely unless one is decommissioned.


## Related

- [[Staged LLM Analysis Pipeline]]
