---
pillar: engineering
title: Parameterized Pipelines Reduce Rewrite Cost
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - pipeline-design
  - reusability
  - script-patterns
---

Swappable judge prompts let the same pipeline evaluate different dimensions without script changes.

The RoleNext gap-analysis pipeline used a `--judge <name>` flag to select which prompt to apply (gap-analysis.txt, match-score.txt, etc.). The shell script stayed generic; specialization lived in prompts. This means adding a new evaluation dimension (e.g., recommendation quality) required a new prompt file, not a new script. Applies beyond LLM judges — any pipeline that batches outputs and applies varying logic benefits from parameterization at the assessment layer.


## Related

- [[Task Isolation Prevents Context Degradation]]
