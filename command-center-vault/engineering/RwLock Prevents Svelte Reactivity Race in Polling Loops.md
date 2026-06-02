---
pillar: engineering
title: RwLock Prevents Svelte Reactivity Race in Polling Loops
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - concurrency
  - svelte
  - reactivity
  - debugging
aliases:
  - reactivity-race
---

Debug overlays with polling-to-update cycles can trigger Svelte reactivity multiple times on concurrent state changes; RwLock prevents duplicate-key errors.

The debug overlay polled for state updates and bound results to Svelte reactivity. Under concurrent state changes, reactivity could fire multiple times on the same key, producing each_key_duplicate errors. The fix: RwLock around polling interval state prevents concurrent reads from triggering the reactivity callback multiple times. The error was subtle because it only surfaced when the overlay tried to render duplicates.


## Related

- [[Concurrency Patterns]]
- [[Svelte Reactivity Pitfalls]]
