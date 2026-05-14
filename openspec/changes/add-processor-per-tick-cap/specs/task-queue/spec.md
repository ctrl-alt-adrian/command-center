## MODIFIED Requirements

### Requirement: Processor loop is cron-driven and idempotent

The system SHALL expose `POST /api/cron` that invokes the processor. The processor SHALL: scan for `pending` tasks, dispatch each to its phase's slash command in FIFO order by `createdAt` until either no pending tasks remain or the per-tick cap is reached, evaluate each phase's gate on completion, and create or advance follow-on tasks. Calling `/api/cron` repeatedly when no work exists SHALL be a no-op. The per-tick cap defaults to 3 and is configurable via `PROCESSOR_PER_TICK_CAP` env var or `PipelineConfig.perTickCap` (per-pipeline override).

#### Scenario: Cron tick with no pending tasks

- **WHEN** `POST /api/cron` is called and no tasks are in `pending`
- **THEN** the response is `{ processed: 0, byPipeline: {}, paused: 0, resumed: 0, deferred: 0 }` and no claude -p processes are spawned

#### Scenario: Cron tick with one pending task

- **WHEN** `POST /api/cron` is called and one task is in `pending`
- **THEN** the processor sets the task to `running`, invokes its phase, applies the gate, persists the resulting status, and returns with `processed: 1, deferred: 0`

#### Scenario: Pending tasks exceed the per-tick cap

- **WHEN** 10 pending tasks exist and `PROCESSOR_PER_TICK_CAP` is 3
- **THEN** the processor dispatches the 3 oldest pending tasks (by `createdAt` ascending), leaves the remaining 7 in `pending`, and returns with `processed: 3, deferred: 7`

#### Scenario: Per-pipeline override raises the cap

- **WHEN** 10 pending tasks belong to a pipeline declaring `perTickCap: 50` and the global cap is 3
- **THEN** the processor dispatches all 10 tasks for that pipeline this tick and returns with `processed: 10, deferred: 0`

#### Scenario: Mixed pipelines respect the global cap

- **WHEN** 5 pending tasks exist for pipeline A (no override) and 5 for pipeline B (no override), global cap 3
- **THEN** the processor dispatches the 3 oldest across both pipelines and defers the rest

### Requirement: Processor reports deferred-task count

The system SHALL include a `deferred` field in the `runProcessor` return value and the `/api/cron` response, counting pending tasks left behind by the per-tick cap on this invocation. The `/tasks` dashboard surface SHALL show a banner when the most recent processor invocation reported `deferred > 0`.

#### Scenario: Captain sees deferred state

- **WHEN** the most recent /api/cron response had `deferred: 12`
- **THEN** /tasks shows a small banner indicating 12 tasks are queued for subsequent ticks

## ADDED Requirements

### Requirement: Backpressure resume does not count against per-tick cap

The system SHALL transition `paused_backpressure` tasks back to `pending` at the start of each processor invocation without consuming the per-tick cap. Whether those resumed tasks actually dispatch this tick depends on their FIFO position in the pending queue.

#### Scenario: Paused task resumes when cap clears

- **WHEN** 1 task is in `paused_backpressure` and 1 needs_review approval frees a backpressure slot
- **THEN** the resume transition fires at the start of the next tick, regardless of the per-tick cap, and the resumed task takes its FIFO position in the pending queue
