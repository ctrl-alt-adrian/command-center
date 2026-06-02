---
pillar: intuition
title: Append-More Feature Doesn't Trigger a Second Billing Event
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - billing
  - feature-design
  - units-of-work
---

When appending to an existing generation, don't charge a second billing event. It's a refinement of the same unit of work.

The generate-more endpoint gates access by plan (Pro only) but doesn't call IncrementUsage. Reasoning: the initial generation already consumed a billing event, and the append is a refinement of that same generation, not a separate unit of work. This keeps billing simple: generate once, pay once. If the append endpoint is abused, a soft cap can be added later without changing the billing model.
