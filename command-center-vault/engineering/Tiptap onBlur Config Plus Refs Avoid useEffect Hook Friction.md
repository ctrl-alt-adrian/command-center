---
pillar: engineering
title: Tiptap onBlur Config Plus Refs Avoid useEffect Hook Friction
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - react
  - tiptap
  - patterns
  - hook-constraints
aliases:
  - framework escape hatch
  - onBlur callback pattern
---

Tiptap's onBlur callback in useEditor config sidesteps project conventions against raw useEffect. Refs solve stale closure problems by capturing objects whose .current updates every render.

RoleNext has a convention blocking useEffect for managing external state (rules/react-effects.md). Tiptap's useEditor({ onBlur: handler }) config is the idiomatic alternative. To access the current editor state without stale closures, use refs: dirtyRef and saveRef let the callback read up-to-date values by accessing .current. This pattern generalizes: when a library offers a configuration callback, prefer it over useEffect listener setup.
