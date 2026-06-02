---
pillar: engineering
title: Domain-Specific Quality Taxonomy Catches Hallucination
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - taxonomy
  - validation
  - intent-quality
  - failure-modes
aliases:
  - Searchable Taxonomy Validation
---

A taxonomy of common search intents with validators catches domain-specific failures that generic keystroke analysis misses.

RoleNext built a searchable taxonomy of common job search intents paired with heuristic validators. Without the taxonomy, keystroke-based suggestions missed failure modes specific to job search: users hallucinating skills not in their resume, submitting incomplete queries like 'senior' without a discipline. The taxonomy structure makes these validators explicit and auditable, and the searchable index lets new validators be added without redeploying the classifier.
