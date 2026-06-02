---
pillar: engineering
title: File Upload Validation With DetectContentType
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - file-upload
  - validation
  - security
aliases:
  - MIME type validation
  - content type detection
---

Validate uploaded file MIME types using http.DetectContentType on the first 512 bytes, rejecting anything not on an allowlist, before fully parsing the multipart body.

Create a validateAndWrapFile helper that reads the first 512 bytes of the uploaded file, calls http.DetectContentType, checks against an allowlist of safe types (e.g. application/pdf, image/png), and returns either the validated file wrapped in a MultiReader or an error. Apply this before any handler logic that processes the file. This stops malicious uploads early and prevents potential parsing vulnerabilities. Used in both the Analyze and UploadResume endpoints in rolenext.


## Related

- [[Multipart Upload Size Limit]]
