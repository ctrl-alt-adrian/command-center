---
pillar: engineering
title: 'Rate Limiter Bug: RemoteAddr Includes Port'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - rate-limiting
  - networking
  - bug
aliases:
  - RemoteAddr port bug
  - per-connection rate limiter
---

Go's http.Request.RemoteAddr includes the ephemeral port (e.g. 127.0.0.1:54321), so using it directly as a rate limiter key gives each TCP connection its own bucket, completely defeating rate limiting.

The bug: use net.SplitHostPort(r.RemoteAddr) before storing in the rate limit map. Without this, every connection gets a fresh rate limiter instance because each client port is unique. This was discovered in rolenext when testing confirmed requests were not being rate limited at all. The fix is one line of stdlib, but the bug is easy to introduce because it feels like RemoteAddr should be the IP address alone. Verified by temporarily lowering burst to 3 and confirming 429s appeared; restored after verification.


## Related

- [[Backpressure Cap]]
- [[Multipart Upload Size Limit]]
