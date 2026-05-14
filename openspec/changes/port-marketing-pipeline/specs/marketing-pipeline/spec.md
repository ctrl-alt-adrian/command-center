## ADDED Requirements

### Requirement: Marketing pipeline registers a four-phase DAG

The system SHALL register a `marketing` pipeline whose ordered phases are: `discovery`, `generate`, `slop-check`, `review`. The pipeline SHALL declare its own `backpressureCap` (default 5) and `cronSchedule` (daily 11 AM for top-of-pipeline discovery tasks). Phases SHALL use the following gate types: discovery → `needs_review`, generate → `auto_pass`, slop-check → `deterministic`, review → `needs_review`.

#### Scenario: Daily discovery cron fires

- **WHEN** the 11 AM cron entry POSTs a top-of-pipeline task to the marketing pipeline
- **THEN** a new task enters the `discovery` phase, runs the discovery subagents, and lands in `needs_review` with a ranked candidate list

#### Scenario: Captain approves a candidate

- **WHEN** the captain approves a candidate from the discovery task's output
- **THEN** a new task is created at the `generate` phase, scoped to that candidate, and is dispatched on the next cron tick

### Requirement: Discovery phase runs three subagents in parallel

The `discovery` phase SHALL invoke three subagents inside one claude -p call: a KB scanner (deep-scans `VAULT_ROOT` for pain points and aha moments), a draft inventory checker (Jaccard 0.45 similarity vs. recent drafts), and a signal analyzer (matches candidates against current `signals/`). The orchestrator SHALL score candidates with the five weighted criteria (audience 30%, uniqueness 25%, hook 20%, timeliness 15%, personal relevance 10%) and emit a ranked list of 3–5.

#### Scenario: Discovery produces a ranked candidate list

- **WHEN** discovery completes
- **THEN** its output directory contains `candidates.json` with 3–5 entries, each having a score, source KB entry references, dedup metadata, and matched signals

### Requirement: Generate phase fans out per enabled platform

The `generate` phase SHALL spawn one subagent per enabled platform (linkedin, x, instagram, facebook, reddit, blog) in parallel, each composing its prompt from `cli/write-post-shared.md` plus `cli/write-post-{platform}.md`. The phase SHALL write one draft directory per platform under the task's output and SHALL complete only when all subagents complete.

#### Scenario: Generate runs for all enabled platforms

- **WHEN** the captain has all six platforms enabled and generate runs
- **THEN** six per-platform drafts are written under the task output directory, each with `draft.md`, `meta.json`, and `status.json`

### Requirement: Slop-check is a deterministic gate with three retries

A `deterministic` gate SHALL evaluate the slop engine against each generated draft. On any violation, the gate SHALL return `{ pass: false, reason }` and the processor SHALL revert the task to `generate` with the violations appended to the prompt input. Retry count SHALL cap at 3; after the third failure the task SHALL move to `needs_review` so the captain can decide manually.

#### Scenario: Slop check passes on first try

- **WHEN** all platform drafts produce zero violations
- **THEN** the task auto-advances to `review`

#### Scenario: Slop check fails and retries

- **WHEN** at least one platform draft has violations and retry count < 3
- **THEN** the task is re-dispatched to `generate` with violation feedback in the prompt input

#### Scenario: Slop check exhausts retries

- **WHEN** the third generate attempt still produces violations
- **THEN** the task is moved to `needs_review` with the violations attached for captain decision

### Requirement: Review phase is the human approval gate

The `review` phase SHALL surface the drafts in the dashboard's review bin. Approve SHALL mark source KB entries `usedForContent: true` and move drafts to "approved" status. Reject SHALL revert the task to `generate` for another attempt.

#### Scenario: Captain approves drafts

- **WHEN** the captain clicks Approve in the review bin
- **THEN** all platform drafts are marked approved, source KB entries are flagged `usedForContent: true`, and the task transitions to `completed`

#### Scenario: Captain rejects drafts

- **WHEN** the captain clicks Reject with a note
- **THEN** the task reverts to `generate` with the rejection note added to the prompt input
