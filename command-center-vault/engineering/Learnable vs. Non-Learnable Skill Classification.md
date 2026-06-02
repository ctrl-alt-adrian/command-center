---
pillar: engineering
title: Learnable vs. Non-Learnable Skill Classification
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - skill-classification
  - feature
  - heuristic
aliases:
  - skill-learnable-heuristic
---

Some skills are learnable within a job timeframe (bootcamps, courses, documentation). Others require years of background. Classify and recommend accordingly.

The skill-gap feature recommends learning resources for missing skills. But not all gaps are learnable. Kubernetes basics can be learned in weeks; systems design or domain expertise cannot. Added IsLearnable() heuristic checking keyword patterns (Docker is learnable, embedded systems is not) and job domain. YouTube search is scoped by domain (Go + concurrency videos for Go gaps, not Python). Learnable gaps surface video recommendations; non-learnable gaps surface job-market insights. Domain-aware threading ensures recommendations match the actual job context.
