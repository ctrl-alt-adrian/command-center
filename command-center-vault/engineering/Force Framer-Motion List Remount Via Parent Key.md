---
pillar: engineering
title: Force Framer-Motion List Remount Via Parent Key
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - react
  - framer-motion
  - animations
  - lists
---

When a framer-motion list loses items, the stagger animation doesn't replay. Force a clean remount by keying the motion.ul on the data rather than trying to animate individual item removal.

The 'Top Skill Gaps' card in RoleNext used motion.ul with staggered children animations. After deleting a job, some items would vanish but the stagger didn't replay, leaving visual gaps (items numbered 1, 4, 5 instead of 1, 2, 3). Framer-motion doesn't handle partial list removal well. The fix: key the motion.ul on `skills.map(g => g.skill).join(",")` to force the entire list to unmount and remount whenever the data changes. This triggers a fresh stagger cycle and avoids the stale animation state. Simpler and cleaner than AnimatePresence per-item or removing motion entirely.
