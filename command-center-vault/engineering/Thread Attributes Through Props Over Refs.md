---
pillar: engineering
title: Thread Attributes Through Props Over Refs
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - data-flow
  - component-hierarchy
---

When marking specific child components in a hierarchy, pass attributes down through props rather than using refs or DOM queries.

The onboarding tutorial needed to mark the first card in the tracker's kanban view with a data-onboarding attribute. The structure is TrackerPage renders KanbanColumn renders KanbanCard (in a loop). Three options: thread props down the chain, use refs/DOM queries to find the card, or restructure KanbanColumn to render children from TrackerPage. Threading props was chosen because it preserves React's declarative model and avoids fragile DOM coupling. The cost is explicit prop chains, which is transparent and easy to trace.
