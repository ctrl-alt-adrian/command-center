---
pillar: natural-language
title: Prompt Simplification Reduces Surface Errors
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - prompt-engineering
  - error-reduction
  - prompt-maintenance
---

Removing unused prompt context (unresolved gaps list, mode parameter) and adding explicit output scope reduces LLM errors and noise.

The resume optimizer prompt contained an unresolved gaps list (only used to feed the coverage validator), a mode parameter (never actually used), and implicit output scope. After removing the validator, these elements became deadweight. Cleanup: remove the gaps list, remove the mode parameter, add explicit instruction: only report sections that actually changed. Result: fewer error cases (no failed validations) and less noise (no filler acknowledgments). Principle: every element in a prompt should justify its presence. If it only exists to feed a downstream mechanism that's been removed, it should go too. Prompt cleanup is underrated as an error-reduction strategy.
