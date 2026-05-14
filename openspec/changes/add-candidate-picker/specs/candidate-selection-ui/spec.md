## ADDED Requirements

### Requirement: needs_review tasks with candidate-shaped output render a picker

The system SHALL detect when a `needs_review` task's `output.candidates` is an array of objects and render a per-candidate selection UI on the task detail page. Each candidate row SHALL show: title or hook, all five scores (audienceRelevance, uniqueness, hookStrength, timeliness, personalRelevance), totalScore, tags, source link (when present), and a checkbox.

#### Scenario: Captain opens a discovery needs_review

- **WHEN** the captain visits `/tasks/<id>` for a discovery task in `needs_review`
- **THEN** the page renders the candidate picker with one row per element in `task.output.candidates`, every checkbox starting in the "off" state until the captain interacts

#### Scenario: Tasks without candidate-shaped output render the plain detail view

- **WHEN** the captain visits a `needs_review` task whose output is NOT a candidates array (e.g. a review-phase task or a vault-nuggets extract)
- **THEN** the existing plain task-detail view renders, not the picker

### Requirement: Picker supports bulk-select helpers

The picker SHALL provide three header buttons: "select all", "select none", "select top N by totalScore" (N defaults to 5, configurable via input). Clicking any of these SHALL update the checkbox state across all visible candidates.

#### Scenario: Top 5 quick-select

- **WHEN** the captain clicks "select top 5"
- **THEN** the 5 candidates with the highest `totalScore` are checked; the others are unchecked

### Requirement: Selection persists across sessions before approval

The picker SHALL save the current selection state to the task's `input.approvalSelection` via `POST /api/tasks/<id>/selection` on every checkbox toggle (debounced). Reloading the page SHALL render the previously-saved selection.

#### Scenario: Captain closes and reopens

- **WHEN** the captain selects 3 candidates and closes the browser tab
- **AND** reopens `/tasks/<id>` an hour later
- **THEN** the 3 prior selections are still checked

### Requirement: Approval with selection

The system SHALL extend `POST /api/tasks/<id>/approve` to accept an optional body `{ selectedCandidateIds: string[] }`. When provided, the body's contents SHALL be written to `task.input.approvalSelection` immediately before the processor's `advanceOrComplete` runs. When omitted, the task's existing `input.approvalSelection` (or absence thereof) is used, preserving today's "approve all" behavior for tasks/pipelines that don't use the picker.

#### Scenario: Approve a subset

- **WHEN** the captain has 3 candidates selected and clicks "Approve selected"
- **AND** the UI POSTs `{ selectedCandidateIds: ["a", "b", "c"] }` to the approve endpoint
- **THEN** the task's `input.approvalSelection` is updated to `["a", "b", "c"]` and the processor advances; downstream fanOut sees 3 candidates and creates 3 generate tasks

#### Scenario: Approve all (no body)

- **WHEN** the captain clicks "Approve all" without making a per-candidate selection
- **AND** the UI POSTs no body
- **THEN** `task.input.approvalSelection` is unchanged (or unset) and the processor advances with the default fanOut behavior (all candidates)

#### Scenario: Approve zero with warning

- **WHEN** the captain clicks Approve with zero checkboxes selected
- **THEN** the UI confirms "Approving with 0 selected discards this batch — continue?" before sending the empty selection

## MODIFIED Requirements

### Requirement: Marketing pipeline registers a four-phase DAG

The system SHALL register a `marketing` pipeline whose ordered phases are: `discovery`, `generate`, `slop-check`, `review`. The pipeline SHALL declare its own `backpressureCap` (default 5) and `cronSchedule` (daily 11 AM for top-of-pipeline discovery tasks). Phases SHALL use the following gate types: discovery → `needs_review`, generate → `auto_pass`, slop-check → `deterministic`, review → `needs_review`. Discovery SHALL declare `fanOut` that filters its `output.candidates` by `task.input.approvalSelection` when present, emitting one downstream task per selected candidate; in the absence of `approvalSelection` the fanOut emits one task per candidate (preserving today's behavior).

#### Scenario: Daily discovery cron fires

- **WHEN** the 11 AM cron entry POSTs a top-of-pipeline task to the marketing pipeline
- **THEN** a new task enters the `discovery` phase, runs the discovery subagents, and lands in `needs_review` with a ranked candidate list

#### Scenario: Captain approves selected candidates only

- **WHEN** the captain reviews 53 candidates on `/tasks/<discovery-id>`, selects 3, and clicks "Approve selected"
- **THEN** the discovery task transitions to `completed`, fanOut filters by the 3 selected ids, 3 generate tasks are created (one per chosen candidate), the remaining 50 candidates do not produce tasks

#### Scenario: Captain approves with no per-candidate selection (legacy behavior)

- **WHEN** the captain clicks "Approve all" without selecting individual candidates
- **THEN** fanOut returns one task per candidate in `output.candidates` and 53 generate tasks are created
