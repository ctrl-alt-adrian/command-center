---
pillar: engineering
title: Error States Must Include Retry Handlers, Not Just Fallback UI
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - error-handling
  - ux
  - react-query
  - resilience
aliases:
  - error-retry
  - graceful-failure
  - error-recovery
---

Async operations that can fail need error states with a retry button, not just a message.

DashboardPage and TrackerPage both poll pipelines and query user data. A network glitch or backend hiccup used to show a generic error message with no path forward. Phase 4 added error states with retry handlers, letting users re-fetch without reloading the page. This is a React Query pattern: when a query fails, the component shows isError && <ErrorBanner onRetry={() => refetch()} />. The retry button calls refetch(), which resets the error state and re-runs the query. Without retry, users reload the entire page, losing client state. With retry, they recover without disruption. Error states with retry also reduce support load; users can self-recover from transient failures. This pattern scales: any page with useQuery or useMutation should have an error state with retry.


## Related

- [[Large-Scale Frontend Refactors Follow a Four-Phase Progression]]
