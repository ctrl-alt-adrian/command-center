---
pillar: engineering
title: Svelte each_key_duplicate from Polling Race Condition
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - svelte
  - reactivity
  - polling
  - debugging
aliases:
  - Svelte key duplication
  - polling race
---

Polling that updates reactive state mid-render triggers Svelte's each-block duplicate-key detection.

A debug overlay in Mirukai was polling the app state and updating a reactive store during render. This triggered Svelte's each-block reactivity, which assigns keys to repeated elements and detected unexpected duplicates. The fix was to debounce the polling or isolate poll state from reactive UI state so updates don't fire during the render cycle. When you poll for state changes in Svelte, decouple the polling from UI reactivity.
