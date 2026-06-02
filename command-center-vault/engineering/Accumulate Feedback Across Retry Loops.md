---
pillar: engineering
title: Accumulate Feedback Across Retry Loops
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - retry
  - feedback
  - convergence
  - loops
aliases:
  - Violation accumulation in retries
---

In retry loops with quality feedback, track all violations across all attempts, not just the latest. Feeding back only the most recent attempt causes oscillation; accumulation converges.

When you retry content generation with quality feedback (e.g., a slop gate rejects low-quality output), the natural approach is to show the LLM what failed in the last attempt and ask for a fix. But if you only pass back the latest attempt's violations, the LLM fixes those specific issues and reintroduces patterns it violated earlier. This causes violations to oscillate across retries (13 violations, then 7, then 7, then 10, then 6). The fix: accumulate all unique violated rules across all attempts, then show the LLM the full set of constraints it needs to respect. This converges much faster and avoids oscillation.
