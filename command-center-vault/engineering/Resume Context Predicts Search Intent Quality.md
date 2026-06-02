---
pillar: engineering
title: Resume Context Predicts Search Intent Quality
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - search
  - intent-quality
  - ranking
  - context
  - signal-selection
aliases:
  - User Profile as Signal
---

A user's resume is a stronger predictor of search intent quality than the query alone.

In RoleNext's search intent system, suggestions improved significantly when resume was factored into quality scoring. A junior dev searching 'senior architect' behaves differently than someone with 10 years experience doing the same query. The system extracts key resume fields (skills, experience level) server-side and uses them to validate whether suggestions are grounded in the user's actual background. This catches hallucinated skills and incomplete queries earlier than generic keystroke analysis alone.
