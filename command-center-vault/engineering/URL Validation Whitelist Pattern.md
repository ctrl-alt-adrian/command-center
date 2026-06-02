---
pillar: engineering
title: URL Validation Whitelist Pattern
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - validation
  - url-safety
  - whitelist
  - input-validation
---

Validate URLs by scheme-whitelist and length cap to prevent XSS and open redirects.

The job tracker API implemented isValidJobURL accepting only http/https, rejecting javascript: data: ftp: file: and relative URLs, with a 2048-char cap. Validation runs after required-field checks but before database writes. Tests are table-driven, covering both safe and dangerous boundary cases. This pattern blocks XSS and open-redirect attacks via job URLs stored in user data while remaining simple to audit.


## Related

- [[Input Validation Layers]]
- [[XSS Prevention]]
- [[API Security Gates]]
