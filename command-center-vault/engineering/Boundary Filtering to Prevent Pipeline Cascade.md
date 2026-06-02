---
pillar: engineering
title: Boundary Filtering to Prevent Pipeline Cascade
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - data-quality
  - pipeline
  - filtering
  - error-prevention
---

Filter bad data at the pipeline entry point instead of crashing downstream.

The marketing pipeline's KB scanner (Haiku) occasionally returns candidates with empty hook or topic fields. Rather than letting these candidates flow through the discover-to-generate pipeline and fail in the worker, filter them out before task creation. This prevents the generate worker from crashing with 'No topic/hook in task input' and avoids cascading failures. The pattern: catch data quality issues at boundaries, not in the processing loop. This turns a pipeline crash into a silent skip and keeps the rest of the batch moving.


## Related

- [[Cascading Hook Failures in Pipeline Automation]]
