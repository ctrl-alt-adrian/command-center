## ADDED Requirements

### Requirement: Pipelines are declared as data, not code

The system SHALL allow each domain to register a pipeline by exporting a `PipelineConfig` object containing: `id`, ordered `phases` (each with `id`, `slashCommand`, `gateType`, optional `timeoutMs`, optional `retryPolicy`), `edges` defining phase transitions, and pipeline-level `backpressureCap` and `cronSchedule` fields. The core runtime SHALL NOT import any pipeline-specific code.

#### Scenario: A new domain registers a pipeline

- **WHEN** a domain package exports a `PipelineConfig` from `pipelines/<domain>/pipeline.config.ts` and is added to the central registry
- **THEN** the core processor picks up its phases without any modification to `core/lib/`

#### Scenario: A pipeline omits cap or cron

- **WHEN** a `PipelineConfig` is registered without `backpressureCap`
- **THEN** the runtime applies a default cap of 5 needs_review tasks
- **AND WHEN** `cronSchedule` is omitted the pipeline only runs when tasks are created manually

### Requirement: Three gate types govern phase transitions

The system SHALL support exactly three gate types: `needs_review`, `deterministic`, and `auto_pass`. A phase MUST declare its `gateType`. A `deterministic` gate MUST also provide a `check(task)` function returning `{ pass: boolean, reason?: string }`.

#### Scenario: A needs_review gate pauses for the captain

- **WHEN** a phase completes and its gate is `needs_review`
- **THEN** the task is left in `status: 'needs_review'` and the next phase is NOT auto-created
- **AND** the task surfaces in `/tasks` for human action

#### Scenario: A deterministic gate auto-advances on pass

- **WHEN** a phase completes and its `check(task)` returns `{ pass: true }`
- **THEN** the next phase is auto-created and the task transitions immediately

#### Scenario: A deterministic gate retries on fail

- **WHEN** `check(task)` returns `{ pass: false, reason }`
- **THEN** the task is reverted to the phase's input state, `reason` is recorded, and the cron retries up to the phase's `retryPolicy.maxAttempts` (default 3)

#### Scenario: An auto_pass gate advances unconditionally

- **WHEN** a phase with gate `auto_pass` completes without error
- **THEN** the next phase is created with no check performed

### Requirement: Phase handoffs occur via files on disk

The system SHALL persist each phase's output to a known file path so any subsequent phase, the dashboard, or the captain can read it without re-running claude. Phase outputs MUST live under `tasks/<task-id>/<phase-id>/` by convention.

#### Scenario: A phase writes output

- **WHEN** a claude -p invocation completes for phase `<phase-id>` of task `<task-id>`
- **THEN** its stdout is written to `tasks/<task-id>/<phase-id>/output.md` and any structured metadata is written to `tasks/<task-id>/<phase-id>/meta.json`

#### Scenario: A downstream phase reads upstream output

- **WHEN** phase B is dispatched after phase A
- **THEN** B's slash command receives the path to A's output directory as input
