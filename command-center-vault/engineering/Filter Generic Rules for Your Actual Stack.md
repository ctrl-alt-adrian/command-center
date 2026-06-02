---
pillar: engineering
title: Filter Generic Rules for Your Actual Stack
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - customization
  - rule-relevance
  - stack-specific
---

When distilling generic best-practice guides, filter out rules that don't apply to your stack to avoid noise.

Vercel's 70 React rules included 35+ Next.js/RSC-specific rules (server components, server actions, React.cache()). RoleNext uses Vite + React Router 7 + React Query SPA, not Next.js. Filtered to ~25 applicable rules, dropping RSC entirely. A rule that doesn't apply is noise; it creates false guilt ("am I following the guide wrong?") when you're just using different architecture.


## Related

- [[Distill Large External Guides Into Scoped Rule Sets]]
