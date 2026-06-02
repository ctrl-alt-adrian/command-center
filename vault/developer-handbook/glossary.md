# Glossary

Every key term in Command Center, defined, with a link to the page that explains
it in depth. Code references are `path:line` into the repo.

### phase
One step in a pipeline. A `PhaseConfig` (`core/lib/types.ts:22`) with an optional
`run()` (the work — often a `claude -p` call) and a `gateType`. Phases run one at
a time per task; the processor advances a task one phase per tick.
→ [01-overview.md](01-overview.md), [core/03-processor.md](core/03-processor.md)

### gate
The decision attached to a phase, evaluated **after** its `run()` succeeds. It
decides whether the task advances, stops for review, or rewinds. One of three
`gateType`s.
→ [core/04-gates.md](core/04-gates.md)

### gate types
`GateType = "needs_review" | "deterministic" | "auto_pass"` (`core/lib/types.ts:1`):
- **`auto_pass`** — advance immediately.
- **`deterministic`** — run `check(task)`; pass → advance, fail → rewind+retry,
  then park as `needs_review` with a `gateFailReason`.
- **`needs_review`** — stop and wait for the captain.
→ [core/04-gates.md](core/04-gates.md)

### task
A single unit of work flowing through one pipeline. The `Task` record
(`core/lib/types.ts:91`) holds `pipelineId`, `phaseId`, `status`, `input`,
`output`, `attempts`, `parentId`, etc. Persisted at `tasks/<id>/task.json`.
→ [core/01-data-model.md](core/01-data-model.md), [core/05-task-store.md](core/05-task-store.md)

### pipeline
A registered domain: a `PipelineConfig` (`core/lib/types.ts:59`) — an `id`, an
ordered `phases` array, and tuning knobs. Lives in
`pipelines/<name>/pipeline.config.ts`.
→ [pipelines/00-index.md](pipelines/00-index.md)

### captain
The human operator. Reviews `needs_review` gates and drives approve / reject /
rerun / resume / enable-disable from the dashboard. The system is deliberately
human-in-the-loop at every publishable step.
→ [01-overview.md](01-overview.md)

### fanOut
A `PhaseConfig.fanOut(task)` function (`core/lib/types.ts:36`) that returns an
array of elements; on advance the processor creates one downstream task per
element instead of a single next task. How a discovery phase explodes into many
generate tasks.
→ [core/03-processor.md](core/03-processor.md)

### fanOutBatchSize
A `PipelineConfig` knob (`core/lib/types.ts:79`). When a phase fans out, the
first `fanOutBatchSize` children are created `pending` and the rest `paused_user`,
so one approval doesn't kick off hundreds of `claude` calls at once. Unset = no
limit.
→ [core/03-processor.md](core/03-processor.md), [operations/troubleshooting.md](operations/troubleshooting.md)

### backpressureCap
A `PipelineConfig` knob (default `5`, `DEFAULT_BACKPRESSURE_CAP` in
`core/lib/types.ts:107`). The processor counts `needs_review` tasks per pipeline;
when at the cap, new first-phase tasks park as `paused_backpressure` instead of
piling onto the review queue.
→ [core/03-processor.md](core/03-processor.md)

### perTickCap
The per-pipeline override of the global `PROCESSOR_PER_TICK_CAP`
(`core/lib/types.ts:70`). A pipeline with `perTickCap` set gets its own dispatch
budget per tick; pipelines without one share the global pool. Pending tasks
beyond the cap are `deferred` to the next tick.
→ [core/03-processor.md](core/03-processor.md), [operations/configuration.md](operations/configuration.md)

### slop / slop pack
The pluggable content-quality engine in `core/lib/slop.ts`. A pipeline supplies a
rule pack (e.g. `pipelines/<name>/slop-rules/`); a deterministic "slop-check"
gate runs the rules against generated drafts and fails the gate on a violation.
→ [core/08-slop-engine.md](core/08-slop-engine.md)

### needs_review
A task status (and a gate type). The task has stopped and awaits the captain's
approve/reject. Counted against the pipeline's `backpressureCap`.
→ [core/04-gates.md](core/04-gates.md), [core/02-task-lifecycle.md](core/02-task-lifecycle.md)

### deterministic gate
A gate whose `check(task)` predicate decides pass/fail programmatically (no
human). On fail it rewinds to the previous phase and retries with feedback up to
`retryPolicy.maxAttempts` (default 3), then parks as `needs_review`.
→ [core/04-gates.md](core/04-gates.md)

### retryFromPhase / gateRetryFeedback
The rewind mechanism for a failed deterministic gate. The processor sends the
task back to the **previous** phase and carries the gate's failure reason forward
as `input.gateRetryFeedback` so the regenerating phase can read what went wrong;
a `gateRetryCount` in `input` budgets the retries across the round-trip
(`core/lib/processor.ts` gate-fail branch). The upstream phase auto-advances back
through the gate on the next tick.
→ [core/04-gates.md](core/04-gates.md)

### gateFailReason
A field on `Task` (`core/lib/types.ts:104`) set when a deterministic gate
exhausts its retries. Its presence is what makes `approveTask` refuse to advance
("cannot approve past failed gate") and what `rerunGate` clears.
→ [core/04-gates.md](core/04-gates.md), [operations/troubleshooting.md](operations/troubleshooting.md)

### onExhausted
A `PhaseConfig` hook (`core/lib/types.ts:44`) fired when a deterministic gate
exhausts its retry budget, just before the task transitions to `needs_review`.
Lets the pipeline clean up failing artifacts (e.g. delete bad draft files). Hook
errors are caught and logged — the transition happens regardless.
→ [core/04-gates.md](core/04-gates.md)

### the vault / MACHINE framework
The atomic-note knowledge base under `VAULT_ROOT` (default `vault/`), organized
by the MACHINE framework. Read by `core/lib/vault.ts`; written into by pipelines
like vault-nuggets.
→ [vault/01-machine-framework.md](vault/01-machine-framework.md), [vault/02-how-content-lands.md](vault/02-how-content-lands.md), [core/09-vault-reader.md](core/09-vault-reader.md)

### signals
External inputs scraped or fetched per pipeline, stored under
`signals/<pipeline>/...` (e.g. competitor scrapes, reddit threads, reddit-pmf
landing content). The raw material a pipeline's first phase consumes.
→ [02-architecture.md](02-architecture.md)

### drafts
Generated content outputs (marketing, personal-brand) under `drafts/`. Edited via
the dashboard drafts editor.
→ [pipelines/marketing.md](pipelines/marketing.md), [pipelines/personal-brand.md](pipelines/personal-brand.md)

### processor tick
One run of `runProcessor()` (`core/lib/processor.ts:57`): resume paused tasks →
dispatch pending tasks under the caps → run their phases in parallel → evaluate
gates → persist state. Triggered by `POST /api/cron`, fired every minute by cron.
→ [core/03-processor.md](core/03-processor.md), [operations/cron-and-scheduling.md](operations/cron-and-scheduling.md)

### registry / bootstrap
`core/lib/registry.ts` holds the in-memory map of registered pipelines;
`core/lib/registry-bootstrap.ts` imports every `pipeline.config.ts` and calls
`registerPipeline` for each. `hooks.server.ts` calls `bootstrapPipelines()` on
server boot. This is the **only** file in the runtime that knows about specific
pipelines.
→ [core/07-registry-bootstrap.md](core/07-registry-bootstrap.md)

---

### Task statuses (quick reference)

From `core/lib/types.ts:3`:
`pending` · `running` · `needs_review` · `completed` · `failed` ·
`paused_backpressure` · `paused_user` · `cleared_stale`.
Defined and traced in [core/02-task-lifecycle.md](core/02-task-lifecycle.md).
