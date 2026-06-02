---
pillar: engineering
title: Consolidate N+1 Methods into Single DB Call
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - postgres
  - optimization
  - cte
aliases:
  - N+1 to Single Call
---

Replace multiple single-field UPDATE methods with one UPDATE...RETURNING statement; old methods become thin wrappers.

When you have N methods that each execute a separate UPDATE for one field (UpdateJobTitle, UpdateJobSalary, etc.), consolidate into a single UPDATE that modifies all columns and returns the full row. Use a CTE if you need pre-update validation. Old methods become thin wrappers that call the consolidated version. Eliminates N roundtrips and simplifies callers. Applied in rolenext PR #173 (UpdateJob: 4 separate methods plus 1 read consolidated to 1 call).
