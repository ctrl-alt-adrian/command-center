## MODIFIED Requirements

### Requirement: Review phase is the human approval gate

The `review` phase SHALL surface the drafts in the dashboard's review bin. Approve SHALL mark all source KB entries referenced by `task.input.candidate.id` as `usedForContent: true` via the `onApprove` hook and complete the task. Reject SHALL create a fresh `generate` task in `pending` with the rejection reason in `task.input.rejectFeedback`, mark the current task `failed` with `rerouted to <new-id>` in `error`, and leave existing drafts on disk for inspection.

#### Scenario: Captain approves drafts

- **WHEN** the captain clicks Approve in the review bin
- **THEN** the review task transitions to `completed`
- **AND** the onApprove hook iterates the candidate's source KB id and calls `markUsedForContent` for that entry
- **AND** the KB markdown file's frontmatter `usedForContent: false` is replaced with `usedForContent: true`

#### Scenario: Captain rejects drafts

- **WHEN** the captain clicks Reject with a note "tone is too corporate; rewrite punchier"
- **THEN** the review task transitions to `failed` with error `rerouted to <new-id>`
- **AND** the onReject hook creates a new generate task with `task.input.rejectFeedback = "tone is too corporate; rewrite punchier"` and the original candidate copied through
- **AND** the new generate task picks up on the next /api/cron tick

### Requirement: Generate phase consumes rejectFeedback

The marketing `generate` phase SHALL read `task.input.rejectFeedback` and `task.input.gateRetryFeedback` (from fix-gate-retry-rollback) when present, prepending them to the kbContext passed to claude in distinct labeled blocks (`PRIOR CAPTAIN REJECTION:`, `PRIOR SLOP VIOLATIONS — avoid these:`). When both are present, both render.

#### Scenario: Generate sees rejectFeedback after review rejection

- **WHEN** a generate task is created by the review onReject hook with `rejectFeedback: "tone too corporate"`
- **THEN** the claude prompt for each platform includes a `PRIOR CAPTAIN REJECTION:` block containing "tone too corporate" prepended to the kbContext
