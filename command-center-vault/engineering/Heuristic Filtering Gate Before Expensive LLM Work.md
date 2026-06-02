---
pillar: engineering
title: Heuristic Filtering Gate Before Expensive LLM Work
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scoring
  - gates
  - retrieval
  - cost-optimization
---

Use a deterministic heuristic gate to filter obvious garbage before passing work to an expensive LLM, avoiding wasted inference and reducing downstream brittleness.

The RoleNext explainable scoring pipeline applies a 3-signal heuristic (title Jaccard match, keyword overlap, role-family conflicts) to filter jSearch results before LLM candidate-fit analysis. The heuristic catches ~90% of cross-domain garbage (nurses appearing for software engineer searches) with zero false positives. This avoids the latency, cost, and vector-DB dependency of embeddings, and more importantly, prevents the LLM from wasting reasoning cycles on cases where domain-specific rules already have the answer. The pattern: compute what is cheap and deterministic first; reserve the expensive worker for nuanced cases.


## Related

- [[Cross-domain Hard Rejections]]
- [[LLM returns raw backend computes]]
