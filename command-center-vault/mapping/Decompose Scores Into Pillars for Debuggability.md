---
pillar: mapping
title: Decompose Scores Into Pillars for Debuggability
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - scoring
  - matching
  - observability
  - design
aliases:
  - Multi-Dimensional Scoring
---

Breaking a single opaque score into multiple interpretable dimensions transforms scoring from a black box into something diagnosable.

In rolenext's job-matching system, replacing a single matchScore with four pillars (skills, experience, constraints, opportunity) made it possible to debug why matches fail. When a candidate-job pairing scores poorly, you can now ask: is it a skills gap, a constraint violation, weak experience fit, or low opportunity appeal? The four dimensions were extracted via LLM analysis. The payoff extends beyond visibility: rubric bugs surface faster, and you can target fixes to specific failure modes rather than blindly tuning an opaque number.


## Related

- [[Occupation-Aware Rubrics Beat Single Global Rules]]
- [[Pre-Filter Jobs Before Expensive LLM Analysis]]
