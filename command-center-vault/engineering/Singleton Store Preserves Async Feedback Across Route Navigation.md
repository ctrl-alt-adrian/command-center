---
pillar: engineering
title: Singleton Store Preserves Async Feedback Across Route Navigation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - state-management
  - navigation
  - async
  - ui-feedback
aliases:
  - Centralized Store for Cross-Route State
---

Centralized singleton stores preserve async UI state (toasts, button disabled state, in-flight operations) across route changes, preventing race conditions and UI inconsistency.

Local component state gets destroyed on navigation, breaking async feedback. A centralized store keeps toasts, button disabled states, and operation tracking alive across the entire app. In SvelteKit, invalidateAll() refreshes data but destroys toast messages; moving toasts to a singleton store solves this. This architecture prevents race conditions where the user navigates away during an async operation and the UI loses track of what was in-flight.


## Related

- [[Fire-and-Forget Async API Hides State Management Complexity]]
- [[Re-Entry Prevention with Active Operation Tracking]]
