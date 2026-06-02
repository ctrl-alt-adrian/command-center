---
pillar: engineering
title: Backend Spec Enforcement, Frontend Pre-Upload Validation
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - file-upload
  - mime-validation
  - security
---

Validate file type and size at both layers: backend enforces the spec, frontend validates before creating object URLs.

Resume upload handler now whitelists only PDF (per spec), rejecting text/plain and application/zip even though they were in the original list. Avatar upload frontend now validates image type (png, jpeg, webp) and enforces 5 MB size cap before URL.createObjectURL. The accept attribute on the input is a UI hint, not a security boundary. Drag-and-drop and tooling can bypass it. Defense-in-depth: backend validates against the spec, frontend rejects invalid types before the upload request fires. Frontend validation is UX (fail fast with toast feedback), not security.


## Related

- [[File Upload Handling]]
