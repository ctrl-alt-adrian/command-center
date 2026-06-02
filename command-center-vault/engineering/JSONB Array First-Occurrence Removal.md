---
pillar: engineering
title: JSONB Array First-Occurrence Removal
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - postgres
  - jsonb
  - arrays
---

The JSONB `-` operator removes all occurrences of a value; use `#- ARRAY[index]` with a subquery to remove only the first when duplicates exist.

When a JSONB array contains duplicates and you want to remove only the first occurrence of a value, the `-` operator removes all of them. Instead, use `#- ARRAY[index]` with a subquery to find the first matching index: UPDATE jobs SET titles = titles #- ARRAY[array_position(titles, 'Engineer')] WHERE.... Guard with `@>` to handle missing values. Applied in rolenext PR #172 (SkillGap batch rewrite).
