---
pillar: engineering
title: Direct Path Updates Over Symlinks for Maintainability
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - maintenance
  - refactoring
  - configuration
aliases:
  - path migrations
---

When migrating project paths during a rebrand or major refactor, update paths directly in all references rather than creating a symlink to mask the change.

During the rolenext rebrand, paths were updated in the shell pipeline script, systemd unit files, and Obsidian vault directly instead of using a symlink from the old path. Symlinks would hide the problem and create a false sense of safety; if the old path is ever cleaned up, the symlink breaks silently. Direct updates are more discoverable and force you to think through all the places that reference the path. In this case, that meant updating PROJECT_DIR in poll-discord.sh, ExecStart and WorkingDirectory in the systemd unit, and paths in the export-session command.
