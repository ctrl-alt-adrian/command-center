---
pillar: engineering
title: Canonical vs Display-Name Separation
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - normalization
  - display
  - data-consistency
  - skill-gaps
---

Separate normalized canonical keys (for matching) from display names (for UI).

Use lowercase canonical keys internally for all matching operations: grouping skills, cache lookups, progress tracking. Separately maintain display names for UI output, preserving proper casing (kubernetes → Kubernetes, aws → AWS, cicd → CI/CD). Reinforce canonical naming in system prompts rather than relying solely on output parsing. Applied in RoleNext: 80 alias mappings resolve to lowercase canonical keys, 70 display-name overrides drive UI rendering, and OpenAI analyzer prompted to use canonical names as defense-in-depth.


## Related

- [[Normalize Before Caching]]
