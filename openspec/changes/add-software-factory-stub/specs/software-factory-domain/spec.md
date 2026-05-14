## ADDED Requirements

### Requirement: Software-factory namespace is a registered domain

The system SHALL expose `/software-factory` as a distinct dashboard route showing only software-factory pipelines and their tasks. The route SHALL list every pipeline registered under `pipelines/software-factory/` (implemented or reserved) with status (`active` | `reserved`).

#### Scenario: Captain visits the software-factory route

- **WHEN** the captain navigates to `/software-factory`
- **THEN** the page lists all software-factory pipelines, with `daily-housekeeping` shown as `active` and any reserved-but-unimplemented pipelines shown as `reserved`

#### Scenario: New pipeline is added

- **WHEN** a developer adds a new `pipeline.config.ts` to `pipelines/software-factory/` and registers it
- **THEN** `/software-factory` shows it without code changes elsewhere

### Requirement: Daily-housekeeping pipeline clears stale paused tasks

The system SHALL register a `daily-housekeeping` pipeline (single phase, gate `auto_pass`) fired by a 3 AM cron entry. The phase SHALL scan the task store for tasks with `status: 'paused_backpressure'` and `updatedAt` older than 7 days, mark them `status: 'cleared_stale'`, and write a log entry recording task id and reason.

#### Scenario: A stale paused task exists

- **WHEN** a task has been in `paused_backpressure` for more than 7 days and the 3 AM cron fires
- **THEN** the task transitions to `cleared_stale` and an entry is appended to `logs/housekeeping/<date>.log`

#### Scenario: No stale tasks exist

- **WHEN** no tasks meet the staleness criteria
- **THEN** the phase completes with a no-op log entry and the task transitions to `completed`

### Requirement: README documents the pipeline-add pattern

The system SHALL include `pipelines/software-factory/README.md` documenting (a) how to add a new pipeline (config file location, registry hook, dashboard auto-discovery), and (b) the list of reserved-but-unimplemented pipeline names with a paragraph each describing their intended scope.

#### Scenario: A developer adds a new pipeline

- **WHEN** they read `pipelines/software-factory/README.md`
- **THEN** they have sufficient guidance to ship a new pipeline without modifying `core/lib/`
