---
pillar: harness
title: Global Claude Code Commands Add System Prompt Overhead
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - claude-code
  - system-prompt
  - context
  - scaling
---

Skill files in ~/.claude/commands load into every project's system prompt, even when unused.

The command-center dashboard shared a global ~/.claude/commands/gsd/ directory with 57 GSD scheduling skill files. These skills were parsed into the system prompt of every Claude Code project, including projects that never use GSD. Moving the 57 skill descriptions to the dating-scheduler project (where they're actually used) reduced system prompt overhead across the fleet and measurably improved response times. The scaling principle: scope project-specific tools to the project directory, not to user-global locations.
