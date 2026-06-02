---
pillar: engineering
title: Testing HTTP Timeouts with Blocking Handlers
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - timeout
  - http
  - concurrency
---

Use httptest.Server with a blocking handler to test timeout enforcement; defer order prevents deadlock.

Testing that an HTTP timeout is actually enforced requires a server that hangs indefinitely. Use httptest.Server with a handler that never returns, close the done channel first (so the test goroutine unblocks), then defer server.Close() to avoid deadlock. This proves the timeout is real and actually honored under the conditions you care about, not just a nominal configuration value.


## Related

- [[HTTP Testing]]
- [[Concurrency Testing]]
