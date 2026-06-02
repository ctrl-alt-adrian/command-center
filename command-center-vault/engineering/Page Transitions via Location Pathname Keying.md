---
pillar: engineering
title: Page Transitions via Location Pathname Keying
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - animations
  - spa
---

React SPAs can trigger consistent page entrance animations by keying CSS animations to location.pathname changes.

SPA navigation between distinct pages can feel jarring without visual feedback. Keying CSS animations to location.pathname (e.g., page-enter with 300ms fade + 8px translateY) creates a sense of page transition rather than state swap. React re-applies the animation on each pathname change, giving the illusion of distinct page navigation. Applied across rolenext's dashboard, tracker, skills, and settings pages.
