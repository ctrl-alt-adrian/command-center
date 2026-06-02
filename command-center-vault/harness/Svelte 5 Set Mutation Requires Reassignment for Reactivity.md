---
pillar: harness
title: Svelte 5 Set Mutation Requires Reassignment for Reactivity
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - svelte
  - reactivity
  - state-management
---

Svelte 5 reactivity with Sets requires explicit reassignment; proxy-based mutation tracking on Sets is inconsistent.

In marketing-pipeline's PipelineChain.svelte, collapsedChains state as a Set(string) mutates via .add() and .delete() but doesn't trigger re-renders reliably in Svelte 5. Fix: instead of collapsedChains.add(id), use collapsedChains = new Set([...collapsedChains, id]). The reassignment forces reactivity tracking to see the change. This gotcha persists across Svelte 5 patch versions and is worth checking if collapse/expand state stops working.
