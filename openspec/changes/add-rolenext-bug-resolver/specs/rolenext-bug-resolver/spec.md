## ADDED Requirements

### Requirement: Pipeline registers under rolenext namespace

The system SHALL register a pipeline with id `rolenext-bug-resolver` under the `rolenext` namespace (`pipelines/rolenext/bug-resolver/`) via the existing core registry. The pipeline SHALL declare seven phases in order: `poll-issues`, `triage`, `write-handoff`, `fix`, `verify`, `pr`, `post-mortem`. The pipeline SHALL NOT require any modifications to `core/lib/`.

#### Scenario: Pipeline appears in registry

- **WHEN** the command-center processor starts up
- **THEN** `pipelineStatus()` includes an entry with `id: "rolenext-bug-resolver"` and seven phases in the declared order

#### Scenario: Phase gates are correctly typed

- **WHEN** the pipeline config is inspected
- **THEN** `poll-issues`, `write-handoff`, `fix`, `pr`, `post-mortem` have `gateType: "auto_pass"`, and `triage`, `verify` have `gateType: "deterministic"`

### Requirement: Poll phase processes open GitHub issues on rolenext

The `poll-issues` phase SHALL query open GitHub Issues on the configured rolenext repository, apply the deterministic dedup contract, honor throttling caps, and fan out a `triage` task per surviving issue. The poll phase SHALL itself complete without advancing (it does not produce a child phase task for itself); each fan-out is a fresh top-of-pipeline task with `phaseId: "triage"`.

#### Scenario: Single new issue creates one triage task

- **WHEN** the poll phase runs and a new issue exists that passes all dedup layers
- **THEN** exactly one task is created with `pipelineId: "rolenext-bug-resolver"`, `phaseId: "triage"`, and `input.issueNumber` set to the GitHub issue number

#### Scenario: No new issues = no tasks created

- **WHEN** the poll phase runs and every open issue is filtered by Layer 1, 2, or 3
- **THEN** no triage tasks are created and the poll task completes successfully

#### Scenario: Kill-switch file disables polling

- **WHEN** a file named `.disabled` exists in the pipeline directory
- **THEN** the poll phase completes as a no-op, regardless of issue state, and no tasks are created

### Requirement: Three-layer deterministic dedup

The system SHALL apply three dedup layers to every candidate issue, in order. Each layer MUST be deterministic — no embeddings, no LLM similarity, no probabilistic scoring.

**Layer 1 (task-store lookup):** if any existing task has `input.issueNumber === N` and `status` not in (`failed`, `cleared_stale`), skip the issue.

**Layer 2 (GitHub state):** skip if the issue is closed, has a linked PR (open or merged), or carries any of the labels `wontfix`, `duplicate`, `no-bot`.

**Layer 3 (fingerprint):** compute `fp = sha256(normalize(pageUrl) + "::" + normalize(first200chars(description)))`. Normalization rules: `pageUrl` lowercased with query and trailing slash dropped; `description` lowercased, non-alphanumeric stripped, whitespace collapsed. If `fp` matches another issue seen within the last 14 days whose PR is open or merged, label the new issue `bot-skipped` and `duplicate-of-<N>` and skip. Persist `fp → { issueNumber, status, prUrl, seenAt }` in `pipelines/<pipeline-dir>/state/fingerprints.json`.

#### Scenario: Layer 1 catches an in-flight ticket

- **WHEN** issue #47 is open and a task exists for it with status `running`
- **THEN** the poll phase skips #47 and does not create a new task

#### Scenario: Layer 2 catches a closed issue

- **WHEN** issue #47 is closed
- **THEN** the poll phase skips it and does not create a new task

#### Scenario: Layer 2 catches a wontfix label

- **WHEN** issue #47 is open and carries the label `wontfix`
- **THEN** the poll phase skips it

#### Scenario: Layer 3 fingerprint match labels and skips

- **WHEN** issue #50 has the same fingerprint as issue #47, whose PR was merged 3 days ago
- **THEN** the system applies labels `bot-skipped` and `duplicate-of-47` to issue #50 and does not create a triage task

#### Scenario: Layer 3 ignores stale matches

- **WHEN** issue #50 has the same fingerprint as issue #47, whose PR was merged 30 days ago
- **THEN** the fingerprint match is ignored and the poll phase advances to normal processing for #50

### Requirement: Reopened issues bypass Layer 1 and force needs_review

When a GitHub issue is reopened (detected via `state_reason: "reopened"` or equivalent indicator), the system SHALL treat it as a fresh ticket: Layer 1 is bypassed, a new triage task is spawned with `input.attempt: <prev + 1>`, the investigate agent receives the prior merged PR's diff in its context, and the triage gate result is forced to `needs_review` regardless of agent confidence.

#### Scenario: Reopen creates new task

- **WHEN** issue #47 had a completed task with `attempt: 1` and is reopened
- **THEN** a new triage task is created with `input.attempt: 2` and the prior task is unaffected

#### Scenario: Reopen forces needs_review

- **WHEN** a triage task with `input.attempt > 1` completes
- **THEN** the resulting task status is `needs_review` regardless of agent confidence values

#### Scenario: Bounded reopen attempts

- **WHEN** a reopen would create a task with `attempt > 3`
- **THEN** the system creates the task but routes it to `needs_review` immediately with reason `"reopen attempt limit exceeded"`

### Requirement: Throughput caps and kill-switch

The system SHALL enforce these caps on the `poll-issues` phase:

- `maxTicketsPerDay`: maximum tasks created per UTC day (default 5)
- `maxQueueDepth`: maximum total pending+running+needs_review tasks; beyond this, the poll phase creates a sentinel task that routes to `needs_review` (default 20)
- `ticketStaleAfterDays`: any pending task older than this auto-escalates to `needs_review` (default 7)
- `concurrency`: maximum concurrently-running fix/verify tasks (default 1)
- `killSwitchFile`: filename in the pipeline directory that, when present, makes the poll phase a no-op (default `.disabled`)

Caps SHALL be expressed as fields on the pipeline config so they are adjustable without code changes.

#### Scenario: Daily cap blocks 6th ticket

- **WHEN** 5 triage tasks have already been created today and a 6th candidate issue passes dedup
- **THEN** no new task is created, the issue is labeled `bot-deferred`, and the poll phase completes successfully

#### Scenario: Queue depth triggers sentinel

- **WHEN** the queue has 20 active tasks and a 21st would be created
- **THEN** no new triage task is created and a sentinel task is routed to `needs_review` with reason `"queue overflow"`

#### Scenario: Stale ticket auto-escalates

- **WHEN** a pending task has been queued for 8 days
- **THEN** its status changes to `needs_review` with reason `"queued > 7 days, bot bandwidth"`

### Requirement: Triage phase invokes investigate agent (and optionally repro agent)

The `triage` phase SHALL always invoke the investigate agent. When the pipeline config `enableBrowserRepro` is `true`, the phase SHALL additionally invoke the repro agent and run both via `Promise.all`. When `enableBrowserRepro` is `false` (v1 default), the repro agent SHALL NOT run and no Playwright / dev-server / bot-user setup is performed.

The investigate agent SHALL be a `claude -p` call that reads `specs/spec-map.md` and relevant specs, and SHALL use parallel subagents where the prompt directs. It SHALL return structured JSON conforming to the investigate contract in D6 of the design.

The repro agent (when enabled) SHALL drive Playwright (headless) against the configured `reproTarget` and return structured JSON conforming to the repro contract in D6 of the design.

The triage phase SHALL always spawn an isolated git worktree branched from `origin/main` before invoking any agent, and SHALL tear it down on completion (success or failure).

#### Scenario: Worktree is branched from origin/main

- **WHEN** the triage phase begins
- **THEN** the system runs `git fetch origin main` followed by `git worktree add <path> origin/main -b bug/issue-<N>` and never reads the local main checkout

#### Scenario: Investigate runs alone when browser repro is disabled

- **WHEN** the triage phase runs with `enableBrowserRepro: false`
- **THEN** only the investigate agent is invoked, no Playwright session is launched, and no `make db` / dev-server commands run

#### Scenario: Both agents run concurrently when browser repro is enabled

- **WHEN** the triage phase runs with `enableBrowserRepro: true`
- **THEN** both invocations are dispatched before either resolves (verified by interleaved log timestamps in `phase_log` events)

#### Scenario: Investigate agent returns structured JSON

- **WHEN** the investigate agent completes
- **THEN** its phase output contains a parseable JSON object with fields `fixKnown` (boolean), `confidence` (0–1 number), `rootCause`, `filesImplicated`, `specsReferenced`, `proposedFix`, and `notes`

#### Scenario: Repro agent returns structured JSON (v1.1)

- **WHEN** the repro agent completes (with `enableBrowserRepro: true`)
- **THEN** its phase output contains a parseable JSON object with fields `reproduced` (boolean), `confidence` (0–1 number), `evidence`, `steps`, and `notes`

#### Scenario: Trace recording is captured when browser repro runs

- **WHEN** the repro agent finishes a Playwright session (with `enableBrowserRepro: true`)
- **THEN** a `trace.zip` artifact exists at the configured incident path

### Requirement: Triage gate decisions are deterministic

The `triage` phase gate SHALL evaluate the structured agent outputs against the decision table appropriate to the active `enableBrowserRepro` setting. The threshold `triageThreshold` defaults to 0.7 and SHALL be configurable on the pipeline. JSON parse failures route to `needs_review`. The captain's manual `approveTask`/`rejectTask` workflow handles the `needs_review` cases.

**Investigate-only gate (when `enableBrowserRepro: false`):**

| Condition | Decision |
|---|---|
| Investigate JSON fails to parse | `needs_review`, reason `"agent failed to produce structured output"` |
| `investigate.fixKnown && investigate.confidence > triageThreshold` | advance to `write-handoff` |
| `investigate.noBugFound === true` | close the GitHub issue with auto-comment `"🤖 investigation did not surface a code-level bug — closing. Reopen with more detail if it persists."`, route task to `needs_review` with reason `"close: cannot-reproduce (no code-level bug)"` (captain confirms the close on the dashboard) |
| All other combinations | `needs_review`, reason `"low confidence or unclear root cause"` |

**Two-agent gate (when `enableBrowserRepro: true`):**

| Condition | Decision |
|---|---|
| Either agent's JSON fails to parse | `needs_review`, reason `"agent failed to produce structured output"` |
| `repro.reproduced && investigate.fixKnown && both confidences > triageThreshold` | advance to `write-handoff` |
| `!repro.reproduced && !investigate.fixKnown` | close the GitHub issue with auto-comment `"🤖 cannot reproduce — closing. Reopen if the bug persists."`, route task to `needs_review` with reason `"close: cannot-reproduce"` (captain confirms the close on the dashboard) |
| All other combinations | `needs_review`, reason `"mixed signals"` |

**Why `needs_review` and not `completed` on close:** the core processor cannot produce a `completed` terminal state from a non-final phase via the gate machinery. The GitHub issue is auto-closed as a side effect during the phase run; the task then lands in `needs_review` so the captain confirms the recommended close on the dashboard. This is strictly safer than auto-completing.

#### Scenario: Investigate-only confident → advance

- **WHEN** `enableBrowserRepro: false` and `investigate.fixKnown=true, investigate.confidence=0.85`
- **THEN** the task advances to the `write-handoff` phase

#### Scenario: Investigate-only noBugFound → close + needs_review

- **WHEN** `enableBrowserRepro: false` and `investigate.noBugFound=true`
- **THEN** the GitHub issue is closed with the investigation-did-not-surface auto-comment and the task ends in `needs_review` status with `gateFailReason: "close: cannot-reproduce (no code-level bug)"` for captain confirmation

#### Scenario: Investigate-only low confidence → needs_review

- **WHEN** `enableBrowserRepro: false` and `investigate.fixKnown=true, investigate.confidence=0.5`
- **THEN** the task status becomes `needs_review` with reason `"low confidence or unclear root cause"`

#### Scenario: Two-agent confident → advance

- **WHEN** `enableBrowserRepro: true` and `repro.reproduced=true, repro.confidence=0.9, investigate.fixKnown=true, investigate.confidence=0.85`
- **THEN** the task advances to the `write-handoff` phase

#### Scenario: Two-agent both disagree → close + needs_review

- **WHEN** `enableBrowserRepro: true` and `repro.reproduced=false` and `investigate.fixKnown=false`
- **THEN** the GitHub issue is closed with the cannot-reproduce auto-comment and the task ends in `needs_review` status with `gateFailReason: "close: cannot-reproduce"` for captain confirmation

#### Scenario: Two-agent mixed signals → needs_review

- **WHEN** `enableBrowserRepro: true` and `repro.reproduced=true, repro.confidence=0.9` but `investigate.fixKnown=false`
- **THEN** the task status becomes `needs_review` with reason `"mixed signals"`

#### Scenario: JSON parse failure → needs_review

- **WHEN** any agent's output cannot be parsed as JSON
- **THEN** the task status becomes `needs_review` with reason `"agent failed to produce structured output"`

### Requirement: Handoff document is the canonical fix input

The `write-handoff` phase SHALL produce a `handoff.md` file under the task directory that includes: the bug summary, ticket URL, repro steps (validated by the repro agent), captured console errors and HTTP failures, identified files with line ranges, root cause, proposed fix, specs touched, risks/unknowns, and (on revision-mode runs) all prior attempt failure logs. The fix agent SHALL receive this file as its primary input.

#### Scenario: Handoff exists after write-handoff phase

- **WHEN** the `write-handoff` phase completes
- **THEN** a file `handoff.md` exists under the task's output directory and is non-empty

#### Scenario: Handoff carries prior failures on revision

- **WHEN** a fix is retried after a verify failure
- **THEN** the handoff includes a `## Attempt N failure` section with the prior failure log

### Requirement: Fix phase operates in two modes with subagent decomposition

The `fix` phase SHALL support two modes selected by `input.mode`:

- `open` (new bug): claude `-p` with handoff + spec context, edits files in the worktree, captures diff
- `revision` (captain requested changes): claude `-p` with `priorHandoff.md`, optional `reviewerNote` (from the manual button), and auto-pulled line-level PR review comments via `gh api /repos/.../pulls/<N>/comments`. Operates on the existing branch.

The fix agent SHALL decompose multi-file or multi-concern fixes into independent units (typically per-file, per-package, or per-concern) and spawn subagents — one per unit — each receiving only the slice of `handoff.md` relevant to its unit plus the specific files in scope. The parent fix agent SHALL then coordinate the units and assemble the regression test. For single-file or single-function fixes, the fix agent MAY skip decomposition and edit directly.

Retry policy: the fix-retry loop is owned by **`verify.run()`** (not by the processor's per-phase retry). When `make ci` is the sole failure in the verify phase (write-policy + regression checks already passed), `verify` appends the failure log to `handoff.md` and re-invokes the fix agent against the same worktree. This loops up to `cfg.fixRetries` additional attempts (total = 1 initial + `fixRetries`). Each attempt's outcome is recorded in `verify.json.attempts[]`.

#### Scenario: Open mode produces a diff

- **WHEN** the fix phase runs with `mode: "open"` and completes
- **THEN** `git diff --name-only origin/main...HEAD` in the worktree returns at least one path

#### Scenario: Revision mode targets the existing branch

- **WHEN** the fix phase runs with `mode: "revision"` and `prNumber: 152`
- **THEN** the branch `bug/issue-<N>` is checked out and modifications target it (not a new branch)

#### Scenario: Revision pulls reviewer comments

- **WHEN** the fix phase runs with `mode: "revision"`
- **THEN** `gh api /repos/.../pulls/<N>/comments` is invoked and the returned comments are included in the fix agent's prompt

#### Scenario: Retry limit triggers needs_review

- **WHEN** the verify phase has failed `fixRetries + 1` times for the same task
- **THEN** the task status becomes `needs_review` with reason including `"verify failed after N attempts"`

#### Scenario: Multi-file fix uses subagent decomposition

- **WHEN** the fix spans 3 or more files across 2 or more packages
- **THEN** the fix agent's transcript shows subagent invocations, each scoped to a subset of the implicated files

### Requirement: Verify phase runs three independent checks (four in v1.1)

The `verify` phase gate SHALL pass only when **all blocking checks** pass. Failures route to retry (if attempts remain) or `needs_review`:

1. **Write policy diff scan** against `origin/main`:
   - **hard-banned** paths (`*.env`, `*.env.*`, `backend/db/migrations/**`, `.github/**`) → BLOCK, route to `needs_review`, reason `"fix touched <path> (hard-banned)"`
   - **soft-banned** paths (`specs/**`, `docker-compose.yml`, `Makefile`, `package.json`, `pnpm-lock.yaml`, `go.mod`, `go.sum`, `go.work*`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`) → DO NOT block. Record each touched soft-ban path with its category in `verify.softBanTouched: { path, category }[]`. The PR phase reads this to add a label and body callout.
2. **Regression test presence:** diff must include ≥1 new or modified file matching `backend/**/test*` OR `frontend/**/*test*` OR `testing/**`. Else `needs_review`, reason `"no regression test added"`.
3. **`make ci`** in the worktree must exit 0.
4. **Dev repro re-run (v1.1 only, when `enableBrowserRepro: true`):** Playwright re-executes the original triage `steps` against the dev worktree with the fix applied. The bug must NOT occur (no symptom-matching console errors / HTTP failures / DOM state). Before/after evidence is captured for the PR body.

#### Scenario: Hard-banned file blocks fix

- **WHEN** the diff includes a path matching `backend/db/migrations/0042_*.sql`
- **THEN** the verify gate routes the task to `needs_review` with reason `"fix touched backend/db/migrations/0042_*.sql (hard-banned)"`

#### Scenario: Soft-banned file does NOT block fix

- **WHEN** the diff includes a change to `specs/auth.md` and all other checks pass
- **THEN** the verify gate advances the task to the `pr` phase, and `verify.softBanTouched` includes `{ path: "specs/auth.md", category: "specs" }`

#### Scenario: Missing regression test blocks fix

- **WHEN** the diff includes only files under `backend/` and `frontend/src/` and no test files
- **THEN** the verify gate routes the task to `needs_review` with reason `"no regression test added"`

#### Scenario: make ci failure triggers in-verify fix retry

- **WHEN** `make ci` exits non-zero on attempt 1 and write-policy + regression checks are clean
- **THEN** `verify.run()` appends the failure log to `handoff.md`, re-invokes the fix agent against the same worktree, and re-runs all checks (attempt 2)

#### Scenario: Retries are exhausted

- **WHEN** all `1 + fixRetries` attempts have run and the final attempt still has failures
- **THEN** the verify gate returns `pass: false` with a concatenated reason, the task ends in `needs_review`, and `verify.json.attempts[]` records every attempt

#### Scenario: Dev repro re-run still shows the bug (v1.1)

- **WHEN** `enableBrowserRepro: true` and the original repro `steps` execute against the fixed worktree and the bug symptom recurs
- **THEN** the verify gate fails and the task either retries (if attempts remain) or routes to `needs_review`

#### Scenario: All blocking checks pass → advance (v1)

- **WHEN** `enableBrowserRepro: false`, write policy has no hard-ban violations, regression test exists, and `make ci` exits 0
- **THEN** the task advances to the `pr` phase

#### Scenario: All blocking checks pass → advance (v1.1)

- **WHEN** `enableBrowserRepro: true`, write policy has no hard-ban violations, regression test exists, `make ci` exits 0, and the dev repro confirms the bug is gone
- **THEN** the task advances to the `pr` phase

### Requirement: PR phase opens draft PRs in open mode, pushes revisions in revision mode

The `pr` phase SHALL distinguish between open and revision modes by `input.prNumber`:

- **Open mode** (no `prNumber`): push branch `bug/issue-<N>` to origin, run `gh pr create --draft` with the title pattern `fix(<area>): <bug summary> [#<N>]`, body composed from the handoff, labels `bot-fix`, `bug`, `auto-triaged`, assignee + reviewer = captain (`ctrl-alt-adrian`). PR body MUST include `Closes #<N>` to auto-close the issue on merge. If `verify.softBanTouched` is non-empty, the PR SHALL additionally carry the label `bot-touched-soft-banned` and the body SHALL include a `⚠️ Soft-ban paths touched` callout listing each path and its category.
- **Revision mode** (`prNumber` present): push commit to the existing branch, flip PR back to draft via `gh pr ready --undo`, post comment `"🤖 pushed revision addressing review"`. Do NOT open a new PR.

PRs SHALL NEVER be auto-merged or auto-flipped-to-ready by the bot.

#### Scenario: Open mode creates a draft PR

- **WHEN** the pr phase runs with no `prNumber` and the verify phase passed
- **THEN** a new draft PR exists on the rolenext repo with the bot's branch, the captain assigned and requested as reviewer, and labels `bot-fix`, `bug`, `auto-triaged`

#### Scenario: PR body includes Closes #N

- **WHEN** the bot opens a PR for issue #47
- **THEN** the PR body contains the literal string `Closes #47`

#### Scenario: Soft-ban touches surface as label + callout (not a gate)

- **WHEN** the verify phase recorded `verify.softBanTouched: [{ path: "specs/auth.md", category: "specs" }]` and the PR phase opens the PR
- **THEN** the new PR carries the label `bot-touched-soft-banned` and its body contains a `⚠️ Soft-ban paths touched` section listing `specs/auth.md (specs)`

#### Scenario: Empty softBanTouched produces no callout

- **WHEN** the verify phase recorded `verify.softBanTouched: []`
- **THEN** the PR does not carry the `bot-touched-soft-banned` label and the body contains no soft-ban callout

#### Scenario: Revision mode does not open a new PR

- **WHEN** the pr phase runs with `prNumber: 152`
- **THEN** PR #152 receives a new commit on its branch and a comment, and no new PR is created

#### Scenario: Revision flips PR to draft

- **WHEN** the bot pushes a revision to PR #152 (which was in ready-for-review state)
- **THEN** PR #152 is in draft state after the phase completes

### Requirement: Revision flow has two trigger paths

The system SHALL support two ways to initiate a revision task:

- **Automatic:** the poll phase, on each run, inspects open bot-PRs for review activity (`gh api /repos/.../pulls/<N>/reviews` + comments) with a timestamp later than the bot's last commit on that branch. For each PR with new activity, spawn a fix task with `mode: "revision"`, `prNumber`, and `priorHandoff` reference.
- **Manual:** the dashboard exposes a "Revise now" button on each task detail page that POSTs to `/api/tasks` with `phaseId: "fix"`, `mode: "revision"`, and (optionally) a `reviewerNote` text field; then POSTs to `/api/cron` to drain the queue immediately.

Both paths converge on the same `fix` phase invocation; the only difference is who triggered the task creation.

#### Scenario: Auto-detection spawns revision task

- **WHEN** the poll phase runs and PR #152 has a review comment timestamped after the bot's last commit on the branch
- **THEN** a fix task is created with `pipelineId: "rolenext-bug-resolver"`, `phaseId: "fix"`, `input.mode: "revision"`, `input.prNumber: 152`

#### Scenario: Manual button dispatches immediately

- **WHEN** the captain clicks "Revise now" on a task detail page
- **THEN** a task is POSTed to `/api/tasks` and `/api/cron` is also POSTed, draining the queue without waiting for the next 5-minute cron tick

#### Scenario: Auto + manual dedup

- **WHEN** the manual button has just created a fix-revision task for PR #152, and the subsequent auto-poll detects the same review activity
- **THEN** Layer 1 dedup recognizes the existing task and the poll does not create a duplicate

### Requirement: Post-mortem phase produces structured markdown

The `post-mortem` phase SHALL produce one markdown file per task at `vault/incidents/<YYYY-MM-DD>_issue-<N>_<slug>/post-mortem.md`. The companion files `handoff.md` (archived) and `trace.zip` (Playwright trace) SHALL be copied into the same directory. The markdown SHALL begin with YAML frontmatter conforming to the schema below, populated from the task's accumulated phase outputs.

Frontmatter schema (v1):

```yaml
type: incident
issueNumber: <int>
prNumber: <int | null>
date: <YYYY-MM-DD>
status: resolved | escalated | cannot-reproduce
botAttempt: <int>
featureArea: <string>
rootCauseClass: <enum, see below>
filesTouched: <int>
linesChanged: <int>
tokensUsed: null              # v1; populated in v2
durationMinutes: <int>
fixRetryCount: <int>
specsReferenced: [<string>, ...]
ciStatus: passed | failed | skipped
reproEvidence: <path>
tags: [<string>, ...]
```

`rootCauseClass` MUST be one of: `missing-null-check`, `off-by-one`, `race-condition`, `type-mismatch`, `missing-validation`, `wrong-state-transition`, `regex-error`, `timezone`, `encoding`, `missing-migration`, `api-contract-drift`, `dependency-bug`, `spec-implementation-gap`, `other`.

#### Scenario: Post-mortem file exists at expected path

- **WHEN** the post-mortem phase completes for issue #47 on 2026-05-14 with slug `tracker-null-deref`
- **THEN** `vault/incidents/2026-05-14_issue-47_tracker-null-deref/post-mortem.md` exists

#### Scenario: Frontmatter is valid YAML with required keys

- **WHEN** any post-mortem file is parsed
- **THEN** its frontmatter contains all keys listed in the schema and `type` equals `"incident"`

#### Scenario: rootCauseClass is from the fixed taxonomy

- **WHEN** any post-mortem file is parsed
- **THEN** `rootCauseClass` is one of the 14 enumerated values

#### Scenario: Companion files are archived

- **WHEN** the post-mortem phase completes
- **THEN** both `handoff.md` and `trace.zip` exist alongside `post-mortem.md` in the same incident directory

### Requirement: vault/incidents is segregated from marketing-mined content

The post-mortem phase SHALL write exclusively under `vault/incidents/`. The marketing/vault-nuggets pipeline SHALL NOT surface post-mortem files as marketing content. Implementation MAY achieve this either by the marketing pipeline scanning an explicit allowlist of vault directories (excluding `incidents/`), or by the marketing pipeline applying a `type: incident` frontmatter filter that skips matching documents.

#### Scenario: Marketing pipeline ignores incidents

- **WHEN** the marketing/vault-nuggets pipeline runs after a post-mortem is written
- **THEN** the post-mortem markdown does not appear as a marketing content candidate

### Requirement: Cron polls every 15 minutes

The system SHALL add one cron line to `cron/cron.txt` that POSTs a new task to `/api/tasks` with `pipelineId: "rolenext-bug-resolver"` every 15 minutes. The setup-managed comment marker (`# command-center`) SHALL be present so the existing setup script can manage the line.

#### Scenario: Cron line is present and well-formed

- **WHEN** `cron/cron.txt` is inspected
- **THEN** it contains a line matching `*/15 * * * *` that POSTs to `/api/tasks` with `pipelineId: "rolenext-bug-resolver"` and includes the `# command-center` marker

### Requirement: Dashboard surfaces queue, PRs, and post-mortems

The dashboard SHALL provide two routes under `/rolenext/bug-resolver`:

- **Index** (`+page.svelte`): current queue (pending / running / paused / needs_review), recent PRs (open / ready-for-review / merged), post-mortem feed with filters for `featureArea`, `rootCauseClass`, and `status`. The post-mortem feed SHALL render markdown via the existing renderer pipeline (`marked` + DOMPurify) added in the prior KB change.
- **Task detail** (`[taskId]/+page.svelte`): phase progression, repro evidence inline, handoff rendered, and a "Revise now" button (visible only when the task has an open PR) that POSTs to `/api/tasks` and `/api/cron`.

#### Scenario: Index lists current queue

- **WHEN** the captain navigates to `/rolenext/bug-resolver`
- **THEN** they see all current pipeline tasks with their phase, status, and elapsed time

#### Scenario: Post-mortem feed renders markdown

- **WHEN** the captain clicks a post-mortem in the feed
- **THEN** the markdown renders with proper headings, lists, code, links, and frontmatter is hidden or shown structured (per dashboard convention)

#### Scenario: Revise now button only shows for tasks with open PR

- **WHEN** a task has no `prNumber` in its input
- **THEN** the "Revise now" button is not visible on its detail page

#### Scenario: Revise now button POSTs and drains queue

- **WHEN** the captain clicks "Revise now" with reviewer note text
- **THEN** the dashboard POSTs `{pipelineId, phaseId: "fix", input: {mode: "revision", prNumber, reviewerNote}}` to `/api/tasks` followed by a POST to `/api/cron`

### Requirement: Bot user seed script exists in rolenext (v1.1, when `enableBrowserRepro: true`)

When the pipeline is enabled with `enableBrowserRepro: true`, the system SHALL include `rolenext/scripts/seed-bot-user.sh` — an idempotent script that reads `BOT_EMAIL` and `BOT_PASSWORD` from the environment and seeds the dev-Postgres with: one bot user account, two resumes, three saved jobs, and a handful of search-history rows. The script SHALL be safe to run repeatedly without producing duplicate rows. When `enableBrowserRepro: false` (v1 default), this script is NOT a v1 deliverable.

#### Scenario: First run seeds fixtures

- **WHEN** the script runs against an empty dev DB with `BOT_EMAIL` and `BOT_PASSWORD` set
- **THEN** the bot user, 2 resumes, 3 saved jobs, and search history rows are created

#### Scenario: Second run is a no-op

- **WHEN** the script runs against a DB that already contains the bot fixtures
- **THEN** no duplicate rows are created and the script exits 0

#### Scenario: Missing creds fails fast

- **WHEN** the script runs without `BOT_EMAIL` set
- **THEN** the script exits non-zero with a message indicating the missing env var

#### Scenario: v1 does not require the seed script

- **WHEN** the pipeline is configured with `enableBrowserRepro: false`
- **THEN** the pipeline runs to completion (poll → triage → handoff → fix → verify → pr → post-mortem) without invoking or requiring the seed script
