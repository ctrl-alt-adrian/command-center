## Why

Today's deterministic-gate retry sets the failed task back to `pending` at the **same phaseId**. For marketing's slop-check, that means the next tick runs `slop-check.run()` (a no-op) again, then `.check()` reads the same on-disk drafts that just failed, and fails identically. All 3 retries are wasted. The captain ends up with a `needs_review` task they can't act on, holding violations frozen in time.

Marketing-pipeline's original behavior on slop fail is to **roll back to the generate phase** with violation feedback baked into the next generate's prompt. The audit (post-commit `2793f31`) flagged this as P0.

## What Changes

- `PhaseConfig` gains an optional `retryFromPhase?: string` field. When set, on deterministic-gate fail the processor rolls back to the named phase instead of re-running the current one.
- The rollback creates a fresh task at `retryFromPhase` with `input.gateRetryFeedback: string` populated from the failed gate's reason. Phases can read this field and prepend it to their prompts.
- The original failed task is marked `failed` with a `rollback_to: <new-task-id>` cross-reference in `error`, so the audit trail isn't lost.
- Retry count tracking moves from the failed task to the new task's `retryCount` (preserved across rollback) — so the existing `retryPolicy.maxAttempts` cap still works.
- Marketing's `slop-check` declares `retryFromPhase: "generate"`. Marketing's `generate.run()` reads `task.input.gateRetryFeedback` and appends it to `kbContext` so claude sees the violations on the rewrite.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `pipeline-runtime`: deterministic-gate fail can optionally roll back to a named upstream phase instead of re-running the current one
- `marketing-pipeline`: slop-check declares retryFromPhase: "generate" and generate consumes gateRetryFeedback

## Impact

- `core/lib/types.ts` gains `retryFromPhase?: string` on `PhaseConfig`.
- `core/lib/processor.ts` gate-fail branch becomes a small switch: re-run-this-phase (current behavior) vs. rollback-to-named-phase (new).
- `pipelines/marketing/pipeline.config.ts` slop-check declares the rollback target; generate reads `gateRetryFeedback`.
- No data migration. Existing failed slop-check tasks remain failed; captain can manually rerun via "Run discovery" or delete them via the new clear-failed UI.
