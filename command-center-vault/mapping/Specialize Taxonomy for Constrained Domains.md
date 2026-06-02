---
pillar: mapping
title: Specialize Taxonomy for Constrained Domains
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - taxonomy
  - domain-modeling
  - nlu
  - search
aliases:
  - Domain-Specific Beats Off-the-Shelf
---

Job search intent patterns are specific enough that custom taxonomy (job title, location, skill categories) outperforms general NER tools.

Instead of using off-the-shelf named entity recognition, the search intent system built a lightweight domain-specific taxonomy for job search. Intent patterns in job search are predictable and constrained by the resume structure. Custom taxonomy is simpler to calibrate, faster to execute, and more accurate because it models the actual search domain. This applies broadly: when your problem fits a bounded ontology and you have ground truth, specialization wins over generalization.
