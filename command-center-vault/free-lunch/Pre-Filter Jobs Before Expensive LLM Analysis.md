---
pillar: free-lunch
title: Pre-Filter Jobs Before Expensive LLM Analysis
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - cost-optimization
  - pipeline-design
  - llm-api
  - engineering
aliases:
  - Retrieval Quality Filtering
---

Rejecting irrelevant jobs before LLM invocation cuts API costs while improving match quality.

Rolenext added a retrieval-quality filtering step before the multi-dimensional scoring LLM pass. Jobs that clearly don't match get filtered out cheaply, avoiding expensive token spend on obvious mismatches. The signal improves too: clear passes and clear failures exit early, concentrating the LLM budget on ambiguous matches. This reduced API costs by 30 percent. The tradeoff: filtering must be calibrated to avoid false negatives that reject good matches. The team solved calibration via precision/recall golden datasets rather than heuristics.


## Related

- [[Classify Jobs Before Applying Rubrics]]
- [[Golden Datasets Catch Category Regressions]]
