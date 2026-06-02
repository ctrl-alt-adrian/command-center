---
pillar: engineering
title: Auto-Dismiss Toast Timing Varies by Feedback Type
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - toasts
  - feedback
  - ux
  - timing
aliases:
  - Toast Duration Strategy
---

Use shorter auto-dismiss for spinners (3.5s) to reduce clutter, longer for success/error (2.5-6s) so users can read them.

Spinners provide confirmation that an operation started, so they can auto-dismiss quickly (3.5s) to keep the interface clean. Success and error toasts carry information users need to read, so extend visibility to 2.5-6 seconds (longer for errors). Button disabled state persists as the true indicator of in-flight operations; a dismissed spinner toast doesn't confuse users because the button is still disabled. This tiered timing keeps feedback visible when it matters and invisible when it doesn't.


## Related

- [[ID-Based Toast Replacement Enables Atomic Feedback Transitions]]
