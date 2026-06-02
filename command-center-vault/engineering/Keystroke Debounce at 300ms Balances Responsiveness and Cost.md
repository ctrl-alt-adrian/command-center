---
pillar: engineering
title: Keystroke Debounce at 300ms Balances Responsiveness and Cost
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - optimization
  - keystroke
  - debouncing
  - frontend
---

Debounce keystroke input to prevent endpoint thrashing when heuristic and LLM validation run on every character.

With resume-driven suggestions triggering on every keystroke, debouncing was critical to avoid spamming the backend. A 300ms delay prevented thrashing while keeping the UI responsive. Without it, a single user typing would fire dozens of validation requests. This is a practical optimization for any keystroke-driven feature that calls endpoints.


## Related

- [[Keystroke handling]]
- [[Frontend optimization]]
