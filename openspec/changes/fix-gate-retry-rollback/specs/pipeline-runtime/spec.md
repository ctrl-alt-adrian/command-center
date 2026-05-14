## MODIFIED Requirements

### Requirement: Three gate types govern phase transitions

The system SHALL support exactly three gate types: `needs_review`, `deterministic`, and `auto_pass`. A phase MUST declare its `gateType`. A `deterministic` gate MUST also provide a `check(task)` function returning `{ pass: boolean, reason?: string }`. A `deterministic` gate MAY also declare `retryFromPhase: string` to roll back to a named upstream phase on fail instead of re-running the current phase.

#### Scenario: A needs_review gate pauses for the captain

- **WHEN** a phase completes and its gate is `needs_review`
- **THEN** the task is left in `status: 'needs_review'` and the next phase is NOT auto-created
- **AND** the task surfaces in `/tasks` for human action

#### Scenario: A deterministic gate auto-advances on pass

- **WHEN** a phase completes and its `check(task)` returns `{ pass: true }`
- **THEN** the next phase is auto-created and the task transitions immediately

#### Scenario: A deterministic gate retries in place on fail (no rollback)

- **WHEN** `check(task)` returns `{ pass: false, reason }` and the phase does NOT declare `retryFromPhase`
- **THEN** the task is reverted to the phase's input state, `reason` is recorded, and the cron retries up to the phase's `retryPolicy.maxAttempts` (default 3)

#### Scenario: A deterministic gate rolls back to an upstream phase on fail

- **WHEN** `check(task)` returns `{ pass: false, reason }` and the phase declares `retryFromPhase: "<upstream-id>"`
- **THEN** a fresh task is created at `<upstream-id>` with `task.input.gateRetryFeedback = reason`, the original task is marked `failed` with `rolled back to <new-task-id>` in `error`, and the new task inherits `retryCount + 1` from the failed task

#### Scenario: Rollback respects retryPolicy.maxAttempts

- **WHEN** the third rollback attempt's slop-check fails
- **THEN** the third failed slop-check task is marked `needs_review` with the gate failure reason, NOT rolled back a fourth time

#### Scenario: An auto_pass gate advances unconditionally

- **WHEN** a phase with gate `auto_pass` completes without error
- **THEN** the next phase is created with no check performed

### Requirement: Pipeline registry validates retryFromPhase

The system SHALL validate at pipeline registration time that any phase declaring `retryFromPhase` points at a phase that appears earlier in the same pipeline's `phases[]` array. A pipeline that declares `retryFromPhase` pointing forward, at itself, or at a non-existent phase SHALL be rejected with a registration error before the dashboard starts.

#### Scenario: Misconfigured retryFromPhase rejected at registration

- **WHEN** a pipeline is registered with `phases: [a, b, c]` and phase `b` declares `retryFromPhase: "c"`
- **THEN** `registerPipeline` throws "phase b cannot retryFromPhase c (must point earlier in the pipeline)"

## ADDED Requirements

### Requirement: gateRetryFeedback is consumable by upstream phases

Phases that produce artifacts (drafts, notes) and are eligible as rollback targets SHOULD read `task.input.gateRetryFeedback` when populated and incorporate it into their prompts so the rewrite addresses the specific failures. The marketing `generate` phase SHALL append `gateRetryFeedback` to its kbContext when present.

#### Scenario: Generate sees slop feedback after slop-check rollback

- **WHEN** slop-check fails with reason "linkedin L7 [banned-word:delve]: 'delve into'"
- **AND** a fresh generate task is created via rollback with that reason in `gateRetryFeedback`
- **THEN** the next claude -p prompt to generate the drafts includes the feedback as a "PRIOR SLOP VIOLATIONS — avoid these:" block prepended to kbContext
