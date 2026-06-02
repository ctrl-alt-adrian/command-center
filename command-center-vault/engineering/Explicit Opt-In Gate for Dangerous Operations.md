---
pillar: engineering
title: Explicit Opt-In Gate for Dangerous Operations
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - gates
  - migrations
  - production-safety
  - rolenext
---

Gate dangerous operations like database migrations behind explicit flags, not environment detection, to prevent accidental schema changes.

Auto-running migrations when the environment name matches 'prod' seems safe until a new instance spins up, test data seeding runs, or a bug triggers an unintended migration. Instead, use an explicit flag like RUN_MIGRATIONS=true that the operator must set. Rolenext gated all migrations behind this flag; skipping it requires a deliberate choice. This prevents race conditions on first deploy and makes intent visible. The tradeoff: losing a bit of automation for a clear gating signal.


## Related

- [[Startup Validation Catches Configuration Errors Before Traffic]]
