---
pillar: engineering
title: Promise.race Doesn't Cancel Underlying Promises
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - async
  - promises
  - resource-cleanup
---

Promise.race returns the first settled promise but leaves others executing. Child processes continue until their own timeout kills them.

When implementing worker-level timeouts using Promise.race(timeoutPromise, workPromise), the losing promise still runs to completion. For Claude CLI calls, execFile's timeout option kills the child process independently. But for other work, leaked processes or dangling operations can accumulate. The race itself provides no cleanup. If cleanup matters, implement independent timeout mechanisms on the underlying work.
