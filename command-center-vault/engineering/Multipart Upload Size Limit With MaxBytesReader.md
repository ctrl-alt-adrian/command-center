---
pillar: engineering
title: Multipart Upload Size Limit With MaxBytesReader
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - file-upload
  - security
  - dos-prevention
aliases:
  - upload DoS prevention
---

Wrap http.Request.Body in http.MaxBytesReader before calling ParseMultipartForm to enforce a hard size limit and prevent memory exhaustion attacks.

Call `http.MaxBytesReader(w, r.Body, 10<<20)` (10 MB in this example) before `r.ParseMultipartForm()` to fail fast with a 413 Payload Too Large if the client sends more data than allowed. Without this guard, a client can stream gigabytes and exhaust memory before the handler even sees the form. The size limit should be chosen based on your application's legitimate maximum (e.g. 10 MB for resume uploads) and enforced consistently across all multipart endpoints.


## Related

- [[File Upload Validation With DetectContentType]]
