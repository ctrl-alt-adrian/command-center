---
pillar: harness
title: Instrumentation Unblocks Launch Diagnostics
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - instrumentation
  - logging
  - launch
aliases:
  - diagnostic logging
---

Temporary instrumentation logs (zero-score, pillar-skip, missing-classification) identified the root cause of silent 0% failures in < 5 minutes during launch validation.

Launch confidence requires fast root-cause diagnosis. When Anthropic and Palantir returned 0% match scores across the board, adding temporary `[zero-score]`, `[pillar-skip]`, and `[missing-classification]` log blocks immediately surfaced the pattern: the prompt fallback was firing silently for those providers. Without instrumentation, the failure would have shipped undiagnosed. Pattern: for any new code path that can fail silently, add a diagnostic log that fires when you hit the failure case. Remove the log after launch validation passes. The cost is a few log lines; the benefit is 5-minute diagnosis instead of customer reports.


## Related

- [[Silent Prompt Fallbacks Hide Classification Failures]]
