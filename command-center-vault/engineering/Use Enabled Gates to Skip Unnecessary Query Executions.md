---
pillar: engineering
title: Use Enabled Gates to Skip Unnecessary Query Executions
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react-query
  - performance
  - data-fetching
aliases:
  - query-enabled
  - conditional-queries
  - conditional-fetching
---

Set enabled: !!user on queries that require authentication to prevent wasted requests before login.

DashboardPage and TrackerPage both fetch user pipelines and job data on mount. If called before the user is authenticated, they send requests that fail and clutter logs. React Query's enabled option gates query execution: enabled: !!user prevents the query from running until user is defined. This is cleaner than manually checking user in a useEffect and calling refetch(). It also removes the need for staleTime: 0 workarounds, which were previously set to force refetch on remount. With enabled gates, queries don't run until conditions are met, reducing noise in development, testing, and production logs.
