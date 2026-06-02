---
pillar: engineering
title: Prefer Focused Hooks Over Mega-Hooks
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react
  - hooks
  - design
  - interfaces
aliases:
  - hook extraction strategy
---

When extracting logic from a large component, create multiple small hooks with clean interfaces rather than one mega-hook with a sprawling API.

When SettingsPage needed to shrink, the alternative was extracting all mutations (profile, password, resume, delete) into a single useSettingsMutations hook. This would have saved more lines but created a hook where each mutation needed different dependencies and return types, making the interface unclear. Instead, useAvatarUpload extracted just the avatar logic: a crisp input/output contract, one job, easy to test and reuse. Small focused hooks are easier to document, test, and reason about than consolidated ones trying to hide complexity under one name.
