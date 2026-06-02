---
pillar: engineering
title: Debounce the Request, Not the Response
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - debouncing
  - react
  - api-design
---

Apply debounce to the API trigger, not to the results display, when handling rapid keystroke events.

Common mistake: wrap the results update in a debounce to reduce rendering. Better: debounce the intent update function itself, so the API call only fires after the debounce window closes. This keeps UI feedback immediate (keystroke is acknowledged) while preventing API thrashing. Matters especially in search where keystroke rate is high.


## Related

- [[Keystroke API Thrashing Requires Aggressive Debouncing]]
