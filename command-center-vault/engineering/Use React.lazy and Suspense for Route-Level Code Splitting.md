---
pillar: engineering
title: Use React.lazy and Suspense for Route-Level Code Splitting
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - performance
  - code-splitting
  - react
  - bundles
aliases:
  - lazy-loading
  - route-splitting
  - bundle-splitting
---

Wrap route components in React.lazy() and provide a Suspense fallback to split the bundle by page.

Phase 2 wrapped 10 page components (DashboardPage, TrackerPage, etc.) in React.lazy() and added a Suspense boundary with a loading fallback. This defers the import of each page's code until the route is navigated to, reducing the main bundle by about 60KB. Users on fast connections see the loading spinner briefly; users on slow connections skip downloading pages they never visit. Suspense fallback can be a simple spinner or a skeleton. This is a low-effort, high-impact optimization: no component logic changes, just a wrapper. React Router handles the Suspense boundary automatically if using lazy route definitions.


## Related

- [[Large-Scale Frontend Refactors Follow a Four-Phase Progression]]
