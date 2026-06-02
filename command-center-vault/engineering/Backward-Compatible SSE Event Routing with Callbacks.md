---
pillar: engineering
title: Backward-Compatible SSE Event Routing with Callbacks
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - sse
  - streaming
  - events
  - backward-compatibility
  - http
aliases:
  - multi-event SSE
  - named event routing
---

Extend SSE handlers with an optional onEvent callback to route named events without breaking existing callers.

When adding new named SSE events to an existing streaming response, add an optional onEvent callback parameter to the stream handler function. Default (unnamed) events go to the existing onResult handler; named events go to onEvent. No fragile shape detection, no type changes, no requirement that existing callers update. Used in RoleNext post-search refinement card to send both result data and refinement suggestions over the same stream, April 2026.
