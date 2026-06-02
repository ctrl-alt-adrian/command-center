---
pillar: engineering
title: Model Tiering by Content Length Reduces Cost
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - model-selection
  - cost-optimization
---

Match model capability to task complexity instead of using a universal model.

Not all content requires the same model capability. Short-form platforms (X, Instagram, Facebook) with character limits under 280 characters use Haiku for draft generation. Long-form platforms (LinkedIn, blog, Reddit) use Sonnet. This matches model capability to task complexity and reduces per-request cost for simpler drafts without compromising quality where it matters.


## Related

- [[Parallelized KB Scanning Reduces Wall-Clock Time]]
