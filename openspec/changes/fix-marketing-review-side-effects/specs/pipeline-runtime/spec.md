## ADDED Requirements

### Requirement: PhaseConfig supports onApprove and onReject hooks

The system SHALL allow each phase to declare optional `onApprove(task) => Promise<void>` and `onReject(task, reason) => Promise<void>` hooks on its `PhaseConfig`. These hooks SHALL fire AFTER the standard approval / rejection transition has completed (i.e. after `approveTask` advances the task or `rejectTask` marks it failed). Hook errors SHALL be logged but SHALL NOT roll back the transition.

#### Scenario: Approve hook runs after transition

- **WHEN** a phase declares `onApprove` and the captain approves the task
- **THEN** the processor first advances the task per the standard logic
- **AND** then invokes `onApprove(updatedTask)` with the post-transition task
- **AND** any exception thrown by the hook is logged with a `hook_failed` event but does not affect the task's `completed` status

#### Scenario: Reject hook runs after transition

- **WHEN** a phase declares `onReject` and the captain rejects the task
- **THEN** the processor first marks the task `failed` with the rejection reason
- **AND** then invokes `onReject(updatedTask, reason)` with the failed task and reason string
- **AND** the hook may create new tasks via core's task store

#### Scenario: A phase with no hooks behaves as today

- **WHEN** a phase declares neither hook
- **THEN** approve and reject behave identically to pre-hook behavior
