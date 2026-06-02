---
pillar: engineering
title: Environment Variable Shadowing in Shell
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - debugging
  - env-vars
  - configuration
---

When DATABASE_URL is set in the shell environment, it overrides the .env file completely, even if the .env file is loaded later.

During the rolenext rebrand, old credentials in a shell-exported DATABASE_URL were silently overriding the new credentials in .env. This meant the application was connecting to the old database with old user credentials. The symptom was unexpected connection failures after the rebrand. When debugging env-based configuration, check not just the .env file but also the live environment (use `echo $DATABASE_URL` or `env | grep DATABASE_URL`) before assuming the file is being read. Shell exports persist across sessions if they are in shell rc files.
