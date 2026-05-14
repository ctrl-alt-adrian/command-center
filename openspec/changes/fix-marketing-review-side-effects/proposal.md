## Why

Two missing side effects on the marketing `review` phase, both flagged by the audit (post `2793f31`):

1. **Approve doesn't mark source KB entries `usedForContent: true`.** Phase 2's drafts-editor spec required it: "Only approved drafts mark KB entries as `usedForContent: true`." The current `reviewPhase.run()` is just a log call and approve hits the generic `advanceOrComplete` → `completed`, never touching KB. Consequence: the next discovery run surfaces the same already-shipped candidates again — the deduplication doesn't dedupe.

2. **Reject is terminal.** `core/lib/processor.rejectTask` sets `status: 'failed'` with the reason and stops. Marketing-pipeline's reject creates a fresh `generate` task with rejection feedback so the captain can iterate on copy. The current behavior forces the captain to start over from discovery — wasteful and against the docx's "approves with notes / revises with --resume" flow.

## What Changes

- The `review` phase declares marketing-specific `onApprove` and `onReject` hooks via a new `PhaseConfig` extension point. Keep core generic: hooks fire **after** the existing transition logic completes.
- On approve: hook iterates the task's `input.candidate.id` (singular — review is downstream of fanOut, so each task has one candidate) and calls `markUsedForContent(id)` for the source KB entry.
- On reject: hook creates a fresh `generate` task in pending with the rejection reason in `task.input.rejectFeedback` (mirroring `gateRetryFeedback` semantics from the fix-gate-retry-rollback change). The current task is marked `failed` with `rerouted to <new-id>` in error.
- Marketing `generate` reads `rejectFeedback` (in addition to `gateRetryFeedback`) and surfaces it as a "PRIOR CAPTAIN REJECTION" block in the prompt.

## Capabilities

### New Capabilities
<!-- none — uses extension hooks on PhaseConfig -->

### Modified Capabilities
- `pipeline-runtime`: PhaseConfig gains optional `onApprove` and `onReject` hooks invoked by core's approval / rejection paths
- `marketing-pipeline`: review approval marks source KB entries usedForContent: true; review rejection reroutes to generate with feedback
- `drafts-editor`: approval propagates to KB (was already in the spec but not implemented)

## Impact

- `core/lib/types.ts` PhaseConfig + `core/lib/processor.ts` approveTask / rejectTask gain hook invocations.
- `pipelines/marketing/pipeline.config.ts` reviewPhase declares both hooks; generatePhase reads `rejectFeedback`.
- No data migration. Existing review tasks that were approved before this change won't retroactively mark KB entries — but since command-center has never shipped a draft yet, that's zero impact today.
