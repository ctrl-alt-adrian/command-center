---
pillar: mapping
title: Occupation-Aware Language Increases Interview Prep Relevance
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - personalization
  - language
  - product-design
  - rolenext
aliases:
  - job-type-specific language
  - occupation-specific terminology
---

Interview prep tools need different language for the same concepts across job types because engineers, PMs, and other roles think about problems differently.

When building interview prep for multiple occupations, the same concept needs different names. Engineers discuss 'tech stacks,' product managers talk about 'tooling,' and sales roles reference 'certifications.' RoleNext built a centralized terminology system that dynamically adjusts product language based on the job type. Instead of hardcoding strings across 20+ frontend components, a single `terminology.ts` module maps concepts to occupation-specific output. This prevents inconsistency and enables A/B testing of different phrasings per occupation. The insight: relevance compounds when users see language in their industry's idiom.


## Related

- [[Personalization Through Configuration]]
- [[Single Source of Truth]]
