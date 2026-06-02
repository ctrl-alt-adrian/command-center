---
pillar: engineering
title: Fail Fast on Limits Before Multipart Parsing
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - backpressure
  - validation-order
  - resource-management
  - gates
aliases:
  - early validation
  - limit check before I/O
---

Check resource limits before parsing request bodies to avoid reading upload bytes when the request will be rejected.

In resume upload, the resume count check runs before ParseMultipartForm and MaxBytesReader. This fails fast when the limit is reached without consuming any upload bytes. Parsing first and checking second wastes server resources on I/O and bandwidth on failed uploads. For endpoint handlers that gate on resource limits, make the count check synchronous and early in the handler chain.
