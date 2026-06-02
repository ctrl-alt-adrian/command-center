---
pillar: engineering
title: 'Clerk Avatar Detection: hasImage vs imageUrl'
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - avatar
  - clerk
  - api
---

Clerk's imageUrl always exists even for default avatars; use hasImage to detect actual uploads.

Clerk always provides an imageUrl even when a user hasn't uploaded a custom avatar (it returns a default gradient). This makes imageUrl unreliable for detecting whether a user has a custom image. Use clerkUser.hasImage instead, which is only true when a custom image has been uploaded. This distinction surfaces the gap between 'API provides a fallback' and 'user actually uploaded something.'
