---
pillar: engineering
title: Session Storage Preserves First-Touch Attribution Without Cross-Tab Pollution
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - analytics
  - attribution
  - utm
aliases:
  - sessionStorage for referrer tracking
---

sessionStorage (not localStorage) stores initial referrer on first page load, survives SPA navigation, and auto-clears on tab close, matching first-touch-UTM requirements without leaking across browser tabs.

UTM parameters vanish on SPA navigation. First-touch attribution needs the original referrer to be recorded once and carried through all subsequent page loads in the same session. localStorage persists across tabs, creating cross-tab pollution. sessionStorage is per-tab and auto-clears on close. Pattern: on first app load, store `utm_source` in sessionStorage. On every conversion event, read from sessionStorage (or null if not set). Survives all client-side navigation, doesn't leak to other tabs, and cleans up automatically.


## Related

- [[PostHog Events Lose Context Without Query Carryover]]
