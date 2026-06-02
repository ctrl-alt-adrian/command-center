---
pillar: engineering
title: Heuristic Intent Analysis Avoids LLM Latency
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - search
  - intent
  - latency
  - cost-optimization
aliases:
  - Client-Side Query Analysis
---

Analyze query intent with client-side heuristics instead of calling an LLM. Lower latency, zero cost, sufficient signal for guidance.

The search intent feature runs no LLM. It analyzes query structure on the client: detects broad queries (single-word, very short), finds normalized aliases via taxonomy lookup, identifies adjacent titles that signal misspelling or category confusion. All heuristic, all on keystroke with 400ms debounce. Result: instant feedback, no round-trip latency, no LLM cost. The heuristics are sufficient for triggering guidance without semantic understanding. Worth considering this approach when you need query-time signals but latency or cost rules out an LLM call.
