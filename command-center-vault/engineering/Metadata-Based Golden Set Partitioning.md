---
pillar: engineering
title: Metadata-Based Golden Set Partitioning
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - test-data
  - golden-examples
  - partitioning
aliases:
  - metadata split
  - runtime filtering
---

Partition golden examples into tuning vs held-out via a _meta.split field, not directory separation.

Rather than splitting golden examples into separate directories (tuning/ vs held-out/), add a _meta.split field to each golden example's metadata. Set it to "tuning" or "held-out". Calibrate.sh filters at runtime based on this field. Advantages: preserves existing file structure, backward compatible (defaults to "tuning" if absent), and allows gradual migration of test sets. Also makes it clear in the golden example itself which set it belongs to, rather than hiding that information in the directory structure.


## Related

- [[Taxonomy-Driven Test Case Design for LLM Drift]]
