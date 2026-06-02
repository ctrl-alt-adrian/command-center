---
pillar: engineering
title: Pre-Launch Accessibility Audit Checklist
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - accessibility
  - wcag
  - pre-launch
  - checklist
aliases:
  - a11y launch checklist
  - accessibility gate
---

A systematic pre-launch accessibility audit catches inaccessibility before shipping. Audit ARIA attributes, keyboard navigation, focus management, color contrast, and screen reader support.

Before launch, audit your component against WCAG AA: (1) ARIA attributes — role, aria-label, aria-roledescription, aria-pressed, aria-live; (2) Keyboard navigation — all interactive elements reachable via Tab, arrow keys where needed, or an accessible select dropdown; (3) Focus management — modals trap focus (Radix Dialog does this automatically), focus returns on close; (4) Color contrast — 4.5:1 for normal text, 3:1 for large text or UI components, audit both light and dark themes separately; (5) Screen reader testing — use NVDA or JAWS post-launch. Pair with component-level tests for ARIA attributes and live region announcements. Rolenext kanban (2026-04-13) completed items 1–4 in PR #80; screen reader testing deferred post-launch.
