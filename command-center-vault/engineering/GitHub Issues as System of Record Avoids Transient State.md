---
pillar: engineering
title: GitHub Issues as System of Record Avoids Transient State
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - architecture
  - persistence
  - simplicity
---

For feedback and bug reports that need visibility and action tracking, skip local persistence and write directly to GitHub Issues, keeping the application simpler.

RoleNext's support channel submits feedback and bug reports as GitHub Issues instead of persisting them in the database. This avoids maintaining a separate table, querying for unseen reports, or aging them out. GitHub Issues provide the visibility, threading, and assignment that a team needs, and the system automatically integrates with existing triage workflows. The application's database is only touched to enrich the submission with the user's name and email. This works well for systems where the signal is valuable to the engineering team but not part of the user-facing feature.
