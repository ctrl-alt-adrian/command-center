---
pillar: engineering
title: CSP Configuration for Third-Party Auth Systems
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - csp
  - clerk
  - security
  - turnstile
aliases:
  - Content Security Policy for Auth
  - Clerk CSP Setup
---

Hardening CSP for Clerk requires worker-src, script-src, frame-src, and form-action directives to permit Turnstile, telemetry, and hosted auth.

Clerk and its Turnstile CAPTCHA require multiple CSP exceptions. Without them, auth widgets fail silently or throw CORS errors. Add: worker-src 'self' https://cdn.jsdelivr.net for Clerk workers, script-src 'self' https://challenges.cloudflare.com for Turnstile scripts, frame-src 'self' https://challenges.cloudflare.com for the embed, form-action 'self' for sign-up, and connect-src permissions for telemetry. Debug by opening the browser console and looking for CSP violations while testing auth flows. Silent failures in auth are easy to miss without active monitoring.
