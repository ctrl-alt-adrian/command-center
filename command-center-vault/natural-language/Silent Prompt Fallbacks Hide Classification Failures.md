---
pillar: natural-language
title: Silent Prompt Fallbacks Hide Classification Failures
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - prompt-engineering
  - error-handling
  - instrumentation
aliases:
  - prompt escape hatches
  - silent degradation
---

A permissive fallback in the prompt (if no pillars matched, return empty list) silently produces 0% match instead of raising an error, masking real classification failures.

In RoleNext job-search analyzer, a prompt-level fallback was meant to handle edge cases gracefully: if the LLM couldn't match a job to any pillar, skip analysis rather than error out. The result: jobs got 0% match scores silently, with no indication that classification failed. Anthropic and Palantir were returning 0% across the board until the fallback was removed. The fix: remove the fallback and let the LLM fail hard when classification is incomplete. Paired with instrumentation (log zero-scores at result construction), the silent failure became visible in < 5 minutes during launch diagnostics.


## Related

- [[Instrumentation Unblocks Launch Diagnostics]]
- [[Retrieval Sort Prevents High-Relevance Burial]]
