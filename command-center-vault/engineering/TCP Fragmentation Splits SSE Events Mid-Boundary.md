---
pillar: engineering
title: TCP Fragmentation Splits SSE Events Mid-Boundary
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - testing
  - streaming
  - integration-tests
aliases:
  - chunk-boundary splits
---

Real-world TCP doesn't respect message boundaries. Integration tests for SSE must cover splits at event boundaries, not just malformed JSON.

SSE integration tests often check: well-formed multi-event streams, malformed JSON, missing done envelopes. They miss the real failure mode: TCP fragmentation. A packet might contain `data: ` on one chunk and the JSON on the next, or split an event header mid-line. Frontend code that assumes a full line arrives per read fails silently. Test case: split the stream at the boundary between `data: ` and JSON; assert the parser reassembles it correctly. This test exposed real reassembly bugs that static payload testing would never catch.


## Related

- [[Instrumentation Unblocks Launch Diagnostics]]
