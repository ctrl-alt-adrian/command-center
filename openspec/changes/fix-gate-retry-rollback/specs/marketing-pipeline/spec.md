## MODIFIED Requirements

### Requirement: Slop-check is a deterministic gate with three retries

A `deterministic` gate SHALL evaluate the slop engine against each generated draft. On any violation, the gate SHALL return `{ pass: false, reason }`. The phase SHALL declare `retryFromPhase: "generate"` so the processor's rollback mechanism creates a fresh generate task with the violations in `task.input.gateRetryFeedback`. Retry count SHALL cap at 3 across rollbacks; after the third generate-rollback the resulting slop-check failure SHALL transition the task to `needs_review` for captain manual decision.

#### Scenario: Slop check passes on first try

- **WHEN** all platform drafts produce zero violations
- **THEN** the task auto-advances to `review`

#### Scenario: Slop check fails and rolls back to generate

- **WHEN** at least one platform draft has violations and retry count < 3
- **THEN** the slop-check task is marked `failed` (with `rolled back to <id>` in error), a fresh generate task is created at the original retryFromPhase target with `task.input.gateRetryFeedback` populated, and the next /api/cron tick dispatches the new generate task

#### Scenario: Slop check exhausts rollbacks

- **WHEN** the third rollback's slop-check still produces violations
- **THEN** the final slop-check task transitions to `needs_review` with the violations attached so the captain can decide manually
