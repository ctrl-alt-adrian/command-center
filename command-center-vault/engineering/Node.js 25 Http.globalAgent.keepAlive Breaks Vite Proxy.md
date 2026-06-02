---
pillar: engineering
title: Node.js 25 Http.globalAgent.keepAlive Breaks Vite Proxy
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - vite
  - nodejs
  - dev-tooling
  - debugging
---

Node.js v25 defaults http.globalAgent.keepAlive to true, causing stale connection reuse with Go backends that have 60s idle timeouts.

Node.js v25 changed the default for http.globalAgent.keepAlive to true. When a Vite dev proxy forwards requests to a Go backend with a 60s IdleTimeout, connection reuse exceeds the backend's timeout window, resulting in 'socket hang up' errors. Fix: explicitly create the proxy agent with new http.Agent({ keepAlive: false }). Encountered in rolenext's Vite dev setup.
