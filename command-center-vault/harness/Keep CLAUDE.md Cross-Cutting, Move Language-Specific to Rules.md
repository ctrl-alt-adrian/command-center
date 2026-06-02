---
pillar: harness
title: Keep CLAUDE.md Cross-Cutting, Move Language-Specific to Rules
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - organization
  - CLAUDE.md
  - modularity
---

CLAUDE.md should contain only cross-cutting rules; move language-specific guidance to scoped rules files.

Reduced RoleNext CLAUDE.md to 44 lines by moving Go, React, and PostgreSQL guides to separate files. Kept: cross-cutting Git/Subagent/Specs rules, Code Quality 14 rules (apply everywhere), Testing. Language-specific guidance moved to .claude/rules/. Fast to read, prevents 300-line tome that discourages reading, and scopes help Claude focus on relevant context.


## Related

- [[Scoped Rules with Globs Load Only When Relevant]]
