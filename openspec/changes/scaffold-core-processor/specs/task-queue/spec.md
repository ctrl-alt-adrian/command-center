## ADDED Requirements

### Requirement: Tasks persist as JSON files keyed by id

The system SHALL store each task as a JSON document at `tasks/<task-id>/task.json` containing at minimum: `id`, `pipelineId`, `phaseId`, `status` (`pending` | `running` | `needs_review` | `completed` | `failed` | `paused_backpressure`), `createdAt`, `updatedAt`, and `attempts`.

#### Scenario: A new task is created

- **WHEN** a cron entry or human action POSTs to `/api/tasks`
- **THEN** a new directory `tasks/<id>/` is created, `task.json` is written with `status: 'pending'`, and the task appears in `/tasks`

#### Scenario: A task survives a process restart

- **WHEN** the dashboard process is killed mid-pipeline and restarted
- **THEN** the processor resumes from the task's last persisted state without losing work

### Requirement: Processor loop is cron-driven and idempotent

The system SHALL expose `POST /api/cron` that invokes the processor. The processor SHALL: scan for `pending` tasks, dispatch each to its phase's slash command, evaluate the phase's gate on completion, and create or advance follow-on tasks. Calling `/api/cron` repeatedly when no work exists SHALL be a no-op.

#### Scenario: Cron tick with no pending tasks

- **WHEN** `POST /api/cron` is called and no tasks are in `pending`
- **THEN** the response is `{ processed: 0 }` and no claude -p processes are spawned

#### Scenario: Cron tick with a pending task

- **WHEN** `POST /api/cron` is called and one task is in `pending`
- **THEN** the processor sets the task to `running`, invokes its phase, applies the gate, and persists the resulting status before returning

### Requirement: Per-pipeline backpressure cap of needs_review tasks

The system SHALL enforce a configurable cap (default 5) on the number of `needs_review` tasks per pipeline. When the cap is reached, new top-of-pipeline task creation for that pipeline SHALL be deferred (status `paused_backpressure`) rather than dropped, and SHALL automatically resume the next cron tick after a slot frees up.

#### Scenario: Cap is reached, new task arrives

- **WHEN** a pipeline has 5 tasks in `needs_review` and a cron drops a new top-of-pipeline task
- **THEN** the new task is created with `status: 'paused_backpressure'` and is NOT dispatched

#### Scenario: Cap clears after captain approves

- **WHEN** the captain approves one of the 5 `needs_review` tasks (dropping the count to 4) and the next cron tick fires
- **THEN** the `paused_backpressure` task transitions to `pending` and is dispatched on that tick or the next

#### Scenario: Cap status is visible

- **WHEN** any pipeline has tasks in `paused_backpressure`
- **THEN** `/tasks` displays a banner showing which pipeline is capped and the current needs_review count

### Requirement: Global /tasks route surfaces queue state

The system SHALL expose a `/tasks` page that lists all tasks grouped by pipeline, shows each pipeline's needs_review count vs. cap, and lets the captain filter by status.

#### Scenario: Captain visits /tasks

- **WHEN** the captain navigates to `/tasks`
- **THEN** they see, per pipeline: total tasks, needs_review count, cap value, and a list of tasks with their current phase and status
