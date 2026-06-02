---
pillar: engineering
title: 'Avatar State: Boolean Over Presence Check'
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - state-management
  - avatar
  - component-design
  - rolenext
---

Use an explicit hasImage boolean flag instead of checking imageUrl presence to cleanly separate state representation from data.

In the RoleNext avatar manager, using a hasImage boolean proved cleaner than checking whether imageUrl exists. The boolean clearly represents the logical state (does the user have an avatar?), separate from how that avatar is stored or identified. This pattern reduces conditional logic scattered through the component and makes state transitions explicit. Recommended for any component with optional file uploads or image handling.
