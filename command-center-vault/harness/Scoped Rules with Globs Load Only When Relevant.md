---
pillar: harness
title: Scoped Rules with Globs Load Only When Relevant
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - rules
  - globs
  - token-efficiency
  - context-management
---

Language-specific rules in .claude/rules/ with glob patterns activate only when editing matching files, saving tokens and reducing cognitive load.

Loading language-specific rules everywhere wastes tokens (Go rules when editing React). Created .claude/rules/ files scoped to file-type globs (e.g., `backend/**/*.go`, `frontend/**/*.tsx`) so rules activate only when relevant. RoleNext reduced CLAUDE.md from 300 lines to 44 by splitting Go, React, and PostgreSQL guidance into separate scoped files. Each rule set feels targeted, and context budget stays tight.


## Related

- [[PostToolUse Hooks Automate Deterministic Tasks]]
- [[Keep CLAUDE.md Cross-Cutting]]
