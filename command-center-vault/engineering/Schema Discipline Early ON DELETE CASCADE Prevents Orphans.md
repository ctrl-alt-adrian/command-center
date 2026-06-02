---
pillar: engineering
title: 'Schema Discipline Early: ON DELETE CASCADE Prevents Orphans'
tier: 3
content_ready: true
created: '2026-05-14'
tags:
  - database
  - migrations
  - schema-design
---

Invest in tight schema relationships early to avoid manual cleanup later.

When RoleNext added interview and gap data to the schema, they used ON DELETE CASCADE on foreign keys upfront. This small discipline choice prevented orphaned records and manual cleanup scripts. The cost was one line of DDL; the benefit was eliminating a class of data-integrity issues that would compound as the system grew. Not flashy, but the kind of decision that feels trivial when made and essential when skipped.
