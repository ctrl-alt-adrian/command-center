---
pillar: engineering
title: Blur-Triggered State Without useEffect
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - state
  - event-handler
  - derived-state
  - project-rules
aliases:
  - event-driven state update
  - blur handler pattern
---

Update derived state via blur event handlers instead of useEffect to comply with project rules and keep logic synchronous.

RoleNext project forbids useEffect for derived state. For blur-triggered intent checks on search keywords, define a state variable (e.g., intentKeyword) in the parent component and update it only via a handleKeywordBlur event handler. No debounce, no timer, no effect. The blur event is the signal; the state update is the consequence. Keeps the logic synchronous and the intent clear: input blur triggers analysis, not a side effect watching a dependency.
