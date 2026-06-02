---
pillar: engineering
title: Focused Eval Scripts Enable Fast Iteration on Generation Quality
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - eval-pipeline
  - iteration
  - architecture
---

A focused, single-purpose evaluation script cuts iteration time compared to running a full multi-phase pipeline.

When tuning a generation prompt in RoleNext, a standalone focused script (interview-verify.sh) outperforms extracting a phase from the full eval-pipeline. The full pipeline runs four phases sequentially: analyze, cross-field, optimize, interview. Tuning generation only needs the analyze phase to save a job ID; the remaining overhead slows feedback. The focused script: Phase 1 (sequential API calls to analyze and generate), Phase 2 (parallel claude -p judge sub-agents), Phase 3 (jq aggregation by dimension and issue collection). This reuses the proven architecture from gap-verify.sh and cuts iteration cycle time significantly. Use this pattern when the signal you're optimizing for is contained in one phase and speed matters.


## Related

- [[Parallel Judge Sub-Agents]]
- [[Aggregation Patterns]]
