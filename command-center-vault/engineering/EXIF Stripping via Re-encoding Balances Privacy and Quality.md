---
pillar: engineering
title: EXIF Stripping via Re-encoding Balances Privacy and Quality
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - security
  - privacy
  - image-processing
---

For privacy-sensitive uploads, re-encode JPEG and WebP to strip EXIF metadata. PNG and GIF pass through since they don't carry EXIF.

EXIF data in images includes GPS coordinates, device model, and timestamps, creating privacy leaks when users upload screenshots. JPEG and WebP are decoded and re-encoded to strip metadata. JPEG re-encodes at quality 95 to minimize quality loss. WebP decoding uses `golang.org/x/image/webp` but Go stdlib has no WebP encoder, so WebP converts to PNG during re-encoding (acceptable for screenshots). PNG and GIF pass through unchanged since they don't carry EXIF. This approach adds negligible latency for typical screenshot sizes and keeps the dependency count low.


## Related

- [[MIME-Based Extension Validation Prevents Upload Spoofing]]
