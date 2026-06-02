---
pillar: engineering
title: Layer Keystroke Debounce with API Debounce to Avoid Lag
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - debouncing
  - timing
  - api-design
  - responsiveness
---

Debouncing at the keystroke handler layer (UI timing) and the API request layer (deduplication) must coordinate; mistiming creates perceptible latency.

In rolenext, quality suggestions are triggered on keystroke. Two debouncing layers apply: UI debounce (delay keystroke handling until the user pauses) and API debounce (suppress duplicate in-flight requests). Getting the timing right matters: too-aggressive UI debounce feels sluggish; loose API debounce causes redundant requests. The rolenext approach uses keystroke debounce at 300-500ms (short enough to feel responsive) combined with API request deduplication. This avoids both perceived lag and backend thrashing.
