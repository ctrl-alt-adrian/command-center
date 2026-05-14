## 1. Repo Scaffold

- [ ] 1.1 Initialize SvelteKit app at `dashboard/` (Svelte 5 runes, Tailwind 4, TypeScript, `@sveltejs/adapter-node`), mirroring marketing-pipeline's stack
- [ ] 1.2 Create top-level directories: `core/lib/`, `pipelines/`, `cron/`, `cli/`, `signals/`, `tasks/`, `drafts/`, `vault/`
- [ ] 1.3 Add `.env.example` documenting `COMMAND_CENTER_ROOT`, `VAULT_ROOT`, `PORT=3001`
- [ ] 1.4 Wire `setup.sh` that installs deps, copies cron entry to crontab, and prints next steps
- [ ] 1.5 Add a root `README.md` describing the phase/gate primitive and how to register a pipeline

## 2. Core Types and Registry

- [ ] 2.1 Define `core/lib/types.ts`: `Task`, `TaskStatus`, `GateType`, `PhaseConfig`, `PipelineConfig`, `GateCheckResult`
- [ ] 2.2 Implement `core/lib/registry.ts` with `registerPipeline(config)` and `getPipeline(id)`; pipelines self-register from `pipelines/<domain>/pipeline.config.ts` on dashboard startup
- [ ] 2.3 Write a stub `pipelines/test-pipeline/pipeline.config.ts` (one phase, gate `auto_pass`) for end-to-end validation

## 3. Task Store

- [ ] 3.1 Implement `core/lib/tasks.ts`: `createTask`, `getTask`, `listTasks`, `updateTaskStatus`, `appendAttempt` — all reading/writing `tasks/<id>/task.json`
- [ ] 3.2 Add filesystem locking (advisory file lock) on task writes to survive concurrent processor invocations
- [ ] 3.3 Unit test: create → update → list round-trip

## 4. Claude CLI Wrapper

- [ ] 4.1 Port `core/lib/claude.ts` from marketing-pipeline (execFile with timeout, stdout capture)
- [ ] 4.2 Generalize: take slash command + input dir + output dir, write stdout to `tasks/<id>/<phase>/output.md`

## 5. Processor Loop

- [ ] 5.1 Implement `core/lib/processor.ts`: scan pending tasks, dispatch to phase slash command, evaluate gate, transition status
- [ ] 5.2 Implement gate evaluators for all three gate types (`needs_review`, `deterministic`, `auto_pass`)
- [ ] 5.3 Implement retry on deterministic-gate fail honoring `retryPolicy.maxAttempts` (default 3)
- [ ] 5.4 Implement backpressure cap check before top-of-pipeline task dispatch (default cap 5, override via `PipelineConfig.backpressureCap`)
- [ ] 5.5 Add diagnostics: log every dispatch and gate evaluation with task id and phase id

## 6. HTTP Surface

- [ ] 6.1 Add `POST /api/cron` invoking the processor; respond with `{ processed, byPipeline }`
- [ ] 6.2 Add `POST /api/tasks` to create a top-of-pipeline task for a given pipeline id
- [ ] 6.3 Add `GET /api/tasks` returning the queue grouped by pipeline
- [ ] 6.4 Add `POST /api/tasks/:id/approve` and `POST /api/tasks/:id/reject` for needs_review transitions

## 7. /tasks Page

- [ ] 7.1 Build `/tasks` route in SvelteKit showing all tasks grouped by pipeline
- [ ] 7.2 Surface per-pipeline needs_review count vs. cap with a paused banner when capped
- [ ] 7.3 Add status filter (pending / needs_review / failed / completed)
- [ ] 7.4 Add approve / reject buttons that hit the approval endpoints

## 8. Slop Engine Shell

- [ ] 8.1 Port `core/lib/slop.ts` from marketing-pipeline as a pure rule engine: `runRules(text, rules) => violations[]`
- [ ] 8.2 Keep rule packs pluggable — no marketing-specific rules in core; phase 2 will register them

## 9. Cron Entry

- [ ] 9.1 Write `cron/cron.txt` containing `*/5 * * * * curl -s -X POST http://localhost:3001/api/cron`
- [ ] 9.2 Update `setup.sh` to install this entry into the user's crontab idempotently

## 10. End-to-End Validation

- [ ] 10.1 Start dashboard on port 3001
- [ ] 10.2 POST /api/tasks for the stub `test-pipeline` 6 times in a row
- [ ] 10.3 Verify: 5 tasks reach `needs_review`, the 6th sits in `paused_backpressure`, `/tasks` shows the cap state
- [ ] 10.4 Approve one, fire `/api/cron`, verify the 6th transitions to `pending` and then advances
