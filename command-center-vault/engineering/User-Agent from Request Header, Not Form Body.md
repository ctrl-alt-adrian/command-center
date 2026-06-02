---
pillar: engineering
title: User-Agent from Request Header, Not Form Body
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - security
  - validation
  - client-trust
---

For metadata that clients can spoof trivially, read it from the request header instead of accepting it as form data.

User-Agent is trivially spoofable if sent as a form field (`navigator.userAgent` in JavaScript), because the browser already sends the canonical User-Agent header. Reading from the header (`r.UserAgent()`) is both simpler and more trustworthy. Applied in RoleNext bug reports: removed the frontend `formData.append('userAgent', ...)` and switched to server-side header reading. Cap the header value at 500 chars to handle pathological cases. The pattern generalizes: any metadata the HTTP stack already provides is more reliable than the request body.


## Related

- [[MIME-Based Extension Validation Prevents Upload Spoofing]]
