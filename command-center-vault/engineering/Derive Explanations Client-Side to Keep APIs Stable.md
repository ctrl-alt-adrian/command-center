---
pillar: engineering
title: Derive Explanations Client-Side to Keep APIs Stable
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - api-design
  - frontend
  - iteration
---

Generate score summaries, strengths, and per-pillar explanations on the client from existing data rather than extending the backend API.

For the WhyThisPanel redesign, RoleNext added new explanation content (score summary, strengths, pillar explanations, bottom-line reasoning) without touching the backend. The pillar scores, requirement gaps, and constraint data already existed in AnalysisResult; the frontend derived everything else client-side through pure utility functions. This kept the API stable and let the team iterate on presentation without coordinating backend changes. The design works because explanations are deterministic (score-range thresholds) rather than LLM-generated, avoiding runtime cost or latency concerns.


## Related

- [[Score Ranges for Deterministic Explanations]]
