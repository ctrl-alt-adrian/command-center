---
pillar: intuition
title: Skill Overlap Beats Adjacency in Title Ranking
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - search
  - ranking
  - resume
  - suggestions
  - signal-weighting
aliases:
  - suggestion weighting
  - ranking signals
---

Prioritize resume skill overlap over title adjacency when ranking job title suggestions.

In RoleNext search, initial tests ranked adjacent titles higher than skill-matched titles. Example: DevOps Engineer (adjacent but no resume overlap) ranked above Frontend Engineer (high React/JavaScript overlap) when searching "engineer" with a frontend-heavy resume. Fixing this required reordering the ranking logic: resume skill overlap is primary, title adjacency is secondary, popularity is tertiary. A single test failure exposed that the team's intuitive signal weighting was inverted. This pattern likely applies beyond search — anywhere you rank alternatives, skills matter more than categorical proximity.


## Related

- [[Three-Tier Confidence Ladder for Intent]]
