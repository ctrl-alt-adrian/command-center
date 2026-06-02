---
pillar: intuition
title: Occupation-Aware Rubrics Beat Single Global Rules
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - domain-modeling
  - job-matching
  - product-design
  - hiring
aliases:
  - Domain-Specific Scoring
---

Different job categories require different scoring criteria; a single global rubric misses domain-specific hiring intuitions.

In rolenext, the same candidate-job pairing scores differently depending on the job family. Healthcare hiring disqualifies candidates on criteria that trades roles would reward. Finance values educational background differently than software engineering. The team built six occupation-aware rubrics (software/IT, healthcare, trades, finance, education, general) rather than forcing a single global rule. This required a classifier to tag incoming jobs, then apply the correct rubric. Hiring judgment isn't universal across domains.


## Related

- [[Decompose Scores Into Pillars for Debuggability]]
- [[Classify Jobs Before Applying Rubrics]]
