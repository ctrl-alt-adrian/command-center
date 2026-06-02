---
pillar: engineering
title: Dependency Injection for Environment-Driven Code
tier: 2
content_ready: true
created: '2026-05-14'
tags:
  - go-patterns
  - testability
  - environment-config
---

Pass appEnv as a function parameter rather than reading from os.Getenv, making code testable and explicit about its dependencies.

When gating production behaviors on APP_ENV, add appEnv as a parameter to db.Open() and other functions rather than having them read os.Getenv directly. Go style guide says no mutable globals. Parameter injection is explicit and testable — you can pass 'prod' or 'dev' in tests without touching environment variables. The billing auth middleware already read os.Getenv directly, but new code should prefer injection. Yes, it requires updating every caller (tests, main.go in both services), but it's worth it.
