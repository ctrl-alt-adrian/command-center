---
pillar: engineering
title: Keystroke API Thrashing Requires Aggressive Debouncing
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - api-efficiency
  - debouncing
  - real-time
---

Keystroke-triggered API calls need 500ms+ debounce to prevent request flooding.

At 100ms keystroke intervals, an undebounced keystroke handler fires 10 API requests per second. For resume-driven search intent suggestions, this rapidly becomes expensive. The solution isn't to debounce the UI display of results—it's to debounce the API call itself. Debounce the intent update function at the source, not the results rendering. This keeps the UI responsive to keystroke feedback while preventing API overload.
