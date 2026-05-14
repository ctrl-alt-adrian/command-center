## Why

The processor processes every pending task in a single `/api/cron` invocation. Marketing's discovery → generate fan-out creates 53+ pending generate tasks in one approval. The next cron tick (5-min cadence) tries to run all 53 sequentially in one request, each taking 3-5 minutes — a single `/api/cron` POST blocks for 2.5-4 hours. Subsequent cron POSTs pile up behind it. Either curl times out, the event loop saturates, or the captain restarts the dashboard and loses in-flight work. None of this surfaces — the cron line is "active" but the system is wedged.

The audit (post-fix `2793f31`) flagged this as the #1 production risk before anything claude-spending runs unattended.

## What Changes

- `core/lib/processor.ts` accepts a per-tick cap (default 3) on the number of pending tasks dispatched per `/api/cron` invocation. Tasks not reached this tick remain `pending` for the next tick.
- The cap is configurable two ways: env var `PROCESSOR_PER_TICK_CAP` (global) and `PipelineConfig.perTickCap` (override per pipeline; useful for cheap pipelines like housekeeping that can drain faster).
- Selection within a tick prefers older tasks (FIFO by `createdAt`) so a captain-approved candidate doesn't starve behind newer fan-out output.
- `processor.runProcessor()` return shape gains `deferred: number` (count of pending tasks left behind by the cap) so `/tasks` can show "12 deferred to next tick" rather than appearing stuck.
- No change to backpressure cap semantics — that's a separate per-pipeline gate on `needs_review` count.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `task-queue`: the processor honors a per-tick cap; pending tasks beyond the cap defer to the next tick rather than running in one giant batch

## Impact

- `core/lib/processor.ts` runProcessor loop becomes a slice-and-loop instead of a full-list iteration.
- New env var documented in `.env.example`. Default 3 picked because each marketing generate task fans out ~6 platform claude calls (~3-5 min) and we want to avoid keeping the dashboard busy for more than ~15 min per tick.
- Existing tasks/JSON formats unchanged. No migration.
- `/tasks` page gains a small "N deferred" indicator when applicable; otherwise no UI change.
