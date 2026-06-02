---
pillar: engineering
title: useSyncExternalStore for Live Stats Without useEffect
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - hooks
  - live-updates
  - external-state
---

Use useSyncExternalStore for live tickers instead of useEffect.

Search page needed live elapsed-time and ETA updates. useSyncExternalStore subscribes to an external clock, avoiding useEffect (forbidden by project rules). Keeps time state external to React; subscriptions survive re-renders.


## Related

- [[External State Management]]
- [[React Subscription Patterns]]
