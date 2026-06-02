---
pillar: free-lunch
title: PostToolUse Hooks Automate Deterministic Formatting
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - hooks
  - automation
  - formatting
  - determinism
---

Register a PostToolUse hook to auto-format code after every Write/Edit, eliminating manual invocation and freeing tool-call budget.

Created .claude/hooks/auto-format.sh that runs Biome on frontend files and gofmt+goimports on Go after every Write/Edit. Always deterministic, invisible to user, same output every time. Replaces manual formatting steps that users might forget or that consume tool-call budget. No cognitive load, no "did I remember to format?" worry.


## Related

- [[Scoped Rules with Globs Load Only When Relevant]]
