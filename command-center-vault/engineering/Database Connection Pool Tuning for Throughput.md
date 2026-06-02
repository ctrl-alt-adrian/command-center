---
pillar: engineering
title: Database Connection Pool Tuning for Throughput
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - database
  - performance
  - postgres
aliases:
  - db-pool-pattern
---

Set MaxOpenConns(25), MaxIdleConns(5), ConnMaxLifetime(5min) to balance resource usage and throughput.

Connection pools that are too small bottleneck under load; too large waste memory and exhaust the database. RoleNext's postgres pool was unconfigured (using defaults). Set MaxOpenConns(25) to cap concurrent queries, MaxIdleConns(5) to reuse warm connections, and ConnMaxLifetime(5min) to cycle stale connections. These numbers came from load testing and production observability. Pattern: start conservative (MaxOpenConns = expected concurrent load plus buffer), measure, adjust. Avoid guessing from examples without context.
