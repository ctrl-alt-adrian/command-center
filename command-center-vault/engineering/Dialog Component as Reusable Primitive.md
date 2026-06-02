---
pillar: engineering
title: Dialog Component as Reusable Primitive
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - components
  - modals
  - ui-primitives
  - rolenext
---

Treating modals and overlays as a single reusable dialog primitive enables consistent patterns and reduces duplication across the application.

RoleNext refactored modal patterns by extracting a Dialog component as a UI primitive. Instead of building modals ad-hoc, the team treats dialog and overlay as a single composable component. This approach reduces boilerplate, ensures consistent behavior and styling, and makes it easier to add new modals without rethinking patterns. The avatar crop/zoom modal was built on top of this primitive, which also serves for future overlays like settings and confirmations.
