---
pillar: engineering
title: Component Extraction Targets Oversized Container Pages
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - refactoring
  - component-extraction
  - react
aliases:
  - page decomposition
  - reducing component complexity
---

Oversized page components (500+ lines) benefit from extracting focused sub-components. Concrete data: TrackerPage dropped 46% of lines, SettingsPage dropped 31%.

Large page components become hard to test, reason about, and reuse. RoleNext extracted sub-components from two container pages: TrackerPage went from 778 to 417 lines (46% reduction) by extracting FilterPills, KanbanCard, KanbanColumn, JobListCard. SettingsPage went from 556 to 383 lines (31% reduction) by extracting ProfileForm, PasswordForm, ResumeList, SubscriptionCard, DangerZone. EditorToolbar (~170 lines) was extracted as a shared component to eliminate duplication across two editor pages. These extracted components became the natural unit for focused test suites.
