## 1. Core hooks

- [ ] 1.1 Add `onApprove?: (task: Task) => Promise<void>` and `onReject?: (task: Task, reason: string) => Promise<void>` to `PhaseConfig` in `core/lib/types.ts`
- [ ] 1.2 In `core/lib/processor.ts` `approveTask()`: after the standard advance/complete, fetch the fresh task, invoke `phase.onApprove(updatedTask)` if defined, log `hook_failed` on throw without rolling back
- [ ] 1.3 In `core/lib/processor.ts` `rejectTask()`: after the standard `failed` write, fetch fresh, invoke `phase.onReject(updatedTask, reason)` if defined, log on throw

## 2. Marketing review.onApprove

- [ ] 2.1 In `pipelines/marketing/pipeline.config.ts` `reviewPhase`, declare `onApprove`:
  - Read `task.input.candidate as ScoredCandidate`
  - Call `markUsedForContent(candidate.id)` from `pipelines/marketing/lib/kb.ts`
  - Log success/failure (KB file may not exist if it's a vault note — markUsedForContent already handles this gracefully)

## 3. Marketing review.onReject

- [ ] 3.1 In `reviewPhase`, declare `onReject(task, reason)`:
  - Create a fresh generate task at `pipelines/marketing` with the same parentId, status `pending`
  - Copy `task.input.candidate` and `task.input.kbContext` to the new task
  - Set `task.input.rejectFeedback = reason`
  - Update the failed task's `error` to `rerouted to <new-id>`

## 4. Marketing generate consumes rejectFeedback

- [ ] 4.1 In `generatePhase.run`, read `task.input.rejectFeedback as string | undefined` and `task.input.gateRetryFeedback`
- [ ] 4.2 Build kbContext with conditional blocks:
  ```
  ${kbContext}
  ${gateRetryFeedback ? "\n\nPRIOR SLOP VIOLATIONS — avoid these:\n" + gateRetryFeedback : ""}
  ${rejectFeedback ? "\n\nPRIOR CAPTAIN REJECTION:\n" + rejectFeedback : ""}
  ```
- [ ] 4.3 Remove the now-dead `slopFeedback` field reference (already handled in fix-gate-retry-rollback; ensure consistency)

## 5. UI: reject flow

- [ ] 5.1 `/tasks/[id]/+page.svelte` reject button on review-phase tasks prompts for a reason
- [ ] 5.2 `POST /api/tasks/[id]/reject` already accepts `{ reason: string }`; verify it's plumbed correctly
- [ ] 5.3 After reject, redirect to the new generate task or back to `/tasks` with a flash message

## 6. Verification

- [ ] 6.1 Run discovery → generate → slop-check → review (manual or via cron)
- [ ] 6.2 Approve the review task; observe the source KB file's frontmatter changes from `usedForContent: false` to `true`
- [ ] 6.3 Run discovery again; confirm that candidate no longer surfaces (dedup against usedForContent)
- [ ] 6.4 Reject a different review task with "tone test"; observe a fresh generate task in pending; observe the original draft files remain in `drafts/<dir>/` for inspection; observe `task.input.rejectFeedback` populated
- [ ] 6.5 Run /api/cron; the new generate task runs, claude prompt should include the captain rejection block
