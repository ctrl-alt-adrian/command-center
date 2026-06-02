---
pillar: engineering
title: HTTP.MaxBytesReader Establishes Upload Hard Limit First
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - security
  - upload
  - resource-limits
---

Wrap the request body with http.MaxBytesReader before any parsing to prevent exhausting memory on malformed uploads.

RoleNext's upload validation chain starts with `http.MaxBytesReader`, setting a hard 10MB limit on the entire request body. Only after this limit is established does the handler sniff the first 512 bytes for MIME detection, then check the file size header. This ordering prevents a malicious or buggy client from streaming unlimited data before the application reads a single byte. MaxBytesReader will cut the connection if the limit is exceeded, protecting the server from resource exhaustion.


## Related

- [[MIME-Based Extension Validation Prevents Upload Spoofing]]
