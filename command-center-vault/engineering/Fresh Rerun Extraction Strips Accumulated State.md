---
pillar: engineering
title: Fresh Rerun Extraction Strips Accumulated State
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - retry
  - state-management
  - pipeline
---

When reruns are needed, extract only original candidate input fields; strip slopResults, platforms, and retry counters.

Marketing-pipeline's rerunTask(id) extracts only CANDIDATE_INPUT_FIELDS (hook, angle, tags, scores) and creates a brand-new generate task. It strips slopResults, platforms, date, and retry counters. This prevents rerunning with malformed or stale data from the previous attempt. If slop-check failed, rerun resumes at generate stage. For other failures, the pipeline reruns from scratch. Principle: when a task needs a fresh attempt after failure, start with clean inputs and cleared state, not partial restoration.
