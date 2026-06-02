---
pillar: engineering
title: Groq Failed Requests Count Against Token Limits
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - groq
  - rate-limits
  - api-behavior
aliases:
  - failed-requests-billing
  - groq-token-accounting
---

Failed API requests to Groq still consume against the rolling token-per-day rate limit, creating hidden costs during iteration.

During interview evaluation, Groq requests hit rate limits on the free tier (100k TPD rolling window). Failed requests, whether from validation errors or retries, still counted against the quota. This meant each prompt iteration could exhaust budget even if the output was discarded. The workaround was adding a --reuse-jobs flag to the eval script, which skipped the analyze step and only regenerated interview questions for saved job data, cutting token usage in half per iteration. Key insight: assume failed requests are billable when budgeting API calls.


## Related

- [[Reuse-Jobs Pattern Saves Tokens When Only Prompt Changes]]
