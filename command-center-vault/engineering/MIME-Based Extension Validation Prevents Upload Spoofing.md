---
pillar: engineering
title: MIME-Based Extension Validation Prevents Upload Spoofing
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - security
  - file-upload
  - validation
---

Derive file extensions from detected MIME type, not client-supplied filename, to prevent attackers from uploading executable content with safe extensions.

When accepting file uploads, using `filepath.Ext(header.Filename)` trusts the client. An attacker can upload `payload.html` with a PNG MIME header: the MIME check passes, but the file lands with an `.html` extension. Instead, build a MIME-to-extension map and derive the extension from the detected `Content-Type`. This forces alignment: if a client sends PNG headers but the content is HTML, the MIME detection catches it or re-encoding fails. Applied in RoleNext's bug report screenshot upload.


## Related

- [[HTTP.MaxBytesReader Establishes Upload Hard Limit]]
- [[EXIF Stripping via Re-encoding]]
