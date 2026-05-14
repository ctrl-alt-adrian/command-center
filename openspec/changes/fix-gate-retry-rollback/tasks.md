## 1. Core types

- [ ] 1.1 Add `retryFromPhase?: string` to `PhaseConfig` in `core/lib/types.ts`
- [ ] 1.2 Document the contract in a comment block: applies to deterministic gates only; validated at registration; failure feedback is `task.input.gateRetryFeedback`

## 2. Registry validation

- [ ] 2.1 In `core/lib/registry.ts` `registerPipeline()`, for each phase with `retryFromPhase`: assert the target phase exists and appears earlier in `phases[]`. Throw on violation
- [ ] 2.2 Unit-style sanity check: register a pipeline with bad retryFromPhase, observe throw

## 3. Processor rollback

- [ ] 3.1 In `core/lib/processor.ts` `applyGate()` deterministic-fail branch, detect `phase.retryFromPhase`:
  - If absent: existing behavior (pending + retryCount++)
  - If present: create a fresh task at `retryFromPhase` with `input.gateRetryFeedback = reason`, copy `retryCount + 1` to the new task, mark the failed task `failed` with `rolled back to <new-id>` in `error`
- [ ] 3.2 If `retryCount + 1 >= maxAttempts` AND `retryFromPhase` is set, escalate the CURRENT task to `needs_review` (no further rollback) so the captain can decide
- [ ] 3.3 Log events: `gate_rollback` with from/to/reason

## 4. Marketing wiring

- [ ] 4.1 `pipelines/marketing/pipeline.config.ts` slopCheckPhase declares `retryFromPhase: "generate"`
- [ ] 4.2 generatePhase reads `task.input.gateRetryFeedback as string | undefined`; when present, prepends `\n\nPRIOR SLOP VIOLATIONS — avoid these:\n${feedback}` to kbContext (replaces the dead `slopFeedback` field check)
- [ ] 4.3 Remove the dead `slopFeedback` reference

## 5. Task detail UI

- [ ] 5.1 `/tasks/[id]/+page.svelte` follows `error` for `rolled back to <id>` and renders a clickable link to the successor task
- [ ] 5.2 When a task's `parentId` points at a rolled-back ancestor, surface the chain ("rolled back from <ancestor> due to slop violations on <date>")

## 6. Verification

- [ ] 6.1 Manually create a generate task whose drafts contain a banned word (e.g. "delve" in a fake draft.md). Trigger slop-check phase.
- [ ] 6.2 Observe: slop-check fails; a new generate task is created with `gateRetryFeedback` populated; the failed slop-check has `error: rolled back to <id>`
- [ ] 6.3 The new generate's prompt (verify by reading the phase log or output) includes the prior-slop-violations block
- [ ] 6.4 After 3 rollbacks if drafts still fail, confirm the third slop-check transitions to `needs_review` instead of rolling back a fourth time
