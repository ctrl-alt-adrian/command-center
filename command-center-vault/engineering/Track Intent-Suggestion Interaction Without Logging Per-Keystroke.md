---
pillar: engineering
title: Track Intent-Suggestion Interaction Without Logging Per-Keystroke
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - analytics
  - cardinality
  - event-tracking
  - observability
---

When logging suggestion interactions at scale, aggregate by suggestion source and user action; avoid logging every keystroke to control cardinality.

rolenext tracks whether users click on intent-quality suggestions to measure adoption. At scale, logging every keystroke and suggestion explodes cardinality. The solution: log the suggestion source (heuristic vs. LLM) and the user action (clicked, ignored, dismissed), but batch or sample keystroke events rather than logging each one. This preserves signal for analysis while keeping storage and query costs manageable.
