---
pillar: intuition
title: Importance-First Weighting Avoids Signal Loss in Multi-Criteria Combinations
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - weighting
  - algorithms
  - signal-to-noise
  - priority
aliases:
  - hierarchical weighting
  - contextual importance
---

Combining severity and importance requires weighting order: mark importance first, then weight severity within that context, to avoid averaging away signal.

Skill-gap priority combines two signals—how severe a gap is and how much that skill matters for the target role. Simple averaging muddled both. RoleNext's solution: weight importance first (mark which gaps matter for the role), then weight severity within that context. High-importance-low-severity gaps now surface before low-importance-high-severity ones, matching user feedback that noise hurts decision-making. Weighting order matters: importance sets the frame; severity tunes within it.


## Related

- [[Signal Prioritization]]
- [[Multi-Criteria Ranking]]
