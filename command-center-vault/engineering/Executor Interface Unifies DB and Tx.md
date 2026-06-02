---
pillar: engineering
title: Executor Interface Unifies DB and Tx
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - database
  - go
  - interfaces
  - transactions
aliases:
  - executor pattern
---

In Go, *sql.DB and *sql.Tx both satisfy the same executor interface, enabling transaction-aware methods without code duplication.

Both *sql.DB and *sql.Tx natively satisfy ExecContext, QueryRowContext, and QueryContext. Write your DB methods against the interface, not the concrete type. You get a single implementation that works for both single queries and transactions without wrapper types or code duplication. This pattern was central to adding transaction support to the db-audit layer.
