---
pillar: harness
title: Mechanical Enforcement for Forgotten Code Quality Rules
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - code-quality
  - enforcement
  - ai-assistant
aliases:
  - Enforce rules via shell hooks
---

Move code quality rules from instructions to shell script hooks—humans and AI both forget written guidelines, but scripts don't.

When working with AI coding assistants, written code quality rules get forgotten in every session. The solution: anything that can be checked programmatically should be a hook, not an instruction. Implemented hooks for read-before-write tracking, debug statement detection, file length limits, and pre-commit quality gates (tsc, go vet, vitest). Hard blocks rather than warnings—if the check fires, the violation is real and must be fixed. Code quality becomes mechanical rather than volitional.


## Related

- [[Binary vs. Semantic Rules Partition]]
