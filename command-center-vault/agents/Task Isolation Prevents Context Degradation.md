---
pillar: agents
title: Task Isolation Prevents Context Degradation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - subagent-design
  - judgment-quality
  - context-pollution
aliases:
  - isolation-beats-batch
  - fresh-context-per-task
---

Spawning a fresh sub-agent per task prevents quality degradation from context pollution. Task interference degrades model judgment non-linearly even when tokens remain.

In the RoleNext LLM-as-judge pipeline, each resume analysis spawned a dedicated `claude -p` sub-agent with a fresh context window. The alternative — feeding all resumes to a single judge sequentially — splits the model's attention across unrelated judgments and degrades verdict quality as context fills. The trade-off favors isolation: parallelism is secondary. Task-specific context (one resume, one problem, one decision) keeps the model focused. This design was borrowed from orchestration patterns in subagent architecture: each task owns its own context, and the harness aggregates results.


## Related

- [[Parameterized Judge Prompts]]
- [[LLM-as-Judge Eval Pipelines]]
