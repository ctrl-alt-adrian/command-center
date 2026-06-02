---
pillar: engineering
title: Multi-Dimension Filtering via Tokenized Matching
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - filtering
  - tokenization
  - matching-logic
  - multi-dimension
aliases:
  - Tokenized Title Filtering
  - Stopword-Aware Matching
---

Match on multiple dimensions simultaneously (role type, location, level) by tokenizing both the target text and the filter criteria, applying stopwords and synonyms, and matching with word boundaries.

Naive string matching fails for job titles: "Software Engineer, Remote, US" doesn't match a query for "SWE roles in CA" because the abbreviation 'SWE' doesn't appear in the title. Tokenize both the job title and the filter query, apply a stopwords list (remove 'in', 'the', 'at'), add a synonyms map ('SWE' → 'Software Engineer'), and match tokens with word boundaries. This allows filtering on role type, location, and seniority simultaneously without complex regex or NLP pipelines. The result is debuggable: you can inspect what matches and why.
