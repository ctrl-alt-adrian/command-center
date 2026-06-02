---
pillar: engineering
title: 'Resume-Job Linking: Fallback State + Clear Errors'
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - data-integrity
  - bug-fix
  - state-management
---

Frontend falls back to local state when cache is missing; backend returns clear errors instead of silent fallbacks.

Resume optimizer was applying optimizations to the wrong resume (e.g., nursing resume for tech jobs) because the frontend cached job search context in a cache that wasn't reliably available. Frontend fix: when searchResumeId is missing from cache, fall back to selectedResumeId held in local state. Backend fix: when resolveResumeText() is called with a deleted resume ID, return a clear 400 error instead of silently falling back to the latest resume. This ensures state integrity and gives users clear feedback about mismatches. Pattern: prefer explicit fallbacks over silent fallbacks, and emit errors for data integrity violations rather than hiding them.
