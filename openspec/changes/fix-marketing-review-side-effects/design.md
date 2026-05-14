## Context

Phase 2's spec (`port-marketing-pipeline/specs/drafts-editor`) required: "Approving a single platform draft in isolation SHALL NOT modify KB," but "approval propagates to KB" via the review-bin approval. My port skipped both side effects. The current `reviewPhase.run` is a 5-second no-op log; the approve action is the generic `advanceOrComplete`.

Marketing-pipeline's original processor handles approve / reject by re-creating tasks (approve marks KB + completes; reject re-creates generate with rejection note). That logic doesn't generalize to other domains without dragging marketing concerns into core.

Hook-style extension points keep core clean: any phase can declare `onApprove(task)` and `onReject(task, reason)` that fire after the standard transition. Domain-specific side effects live in the pipeline config.

## Goals / Non-Goals

**Goals:**
- Marketing approval marks all source KB entries referenced by `task.input.candidate.id` as `usedForContent: true`.
- Marketing rejection creates a fresh generate task with `rejectFeedback` in input so the captain can iterate.
- Hook mechanism is generic; vault-nuggets and other future domains can use it without core changes.
- The standard transition (approve → completed, reject → failed) still happens. Hooks are additive, not replacement.

**Non-Goals:**
- Changing what "approve" means structurally (still completes the task; still triggers any downstream phase via advanceOrComplete).
- Editing drafts pre-approval. (That's the port-drafts-editor-affordances change.)
- Bulk approve / bulk reject across multiple review tasks. Per-task only.

## Decisions

**1. Hooks are post-transition, not pre.** `approveTask` first sets the task to `completed` (or advances if applicable), THEN calls `onApprove`. Same for reject. This way, hook failures don't roll back the transition — the captain's intent is honored even if a side effect glitches. Logged but not blocking.

**2. Hooks receive the current task object and (for reject) the reason string.** Signature: `onApprove(task: Task) => Promise<void>` and `onReject(task: Task, reason: string) => Promise<void>`.

**3. Hooks can create new tasks via core's `createTask`.** Marketing's onReject does this. Nothing prevents the hook from creating multiple tasks if needed — but documented as the rare case.

**4. Hooks log failures but don't fail the transition.** If `markUsedForContent` throws (e.g. KB file is locked), the approve still completes. We log a warning and move on. Alternative: roll back on hook failure. Rejected — that turns the approve action into a transaction with retry semantics, far more complex.

**5. `rejectFeedback` is a separate field from `gateRetryFeedback`.** They serve different purposes (human-driven vs gate-driven retry) and may want different prompt-template treatment. Generate concatenates both when present.

## Risks / Trade-offs

- [Risk] Hook side effects diverge from task state. E.g. KB marked usedForContent but a subsequent rollback un-completes the review. → Mitigation: hooks fire only on the terminal transition path. Once completed, completed.
- [Risk] Reject hook creates a new generate task that the captain didn't expect, blowing through the per-tick cap. → Mitigation: per-tick cap (separate proposal) handles it.
- [Risk] Captain rejects, the new generate task fails, no obvious link back. → Mitigation: `parentId` chains; UI shows the chain on /tasks/[id].

## Migration Plan

1. Add `onApprove` and `onReject` fields to PhaseConfig.
2. Wire `approveTask` and `rejectTask` in `core/lib/processor.ts` to call hooks after the standard transition completes.
3. Marketing reviewPhase declares both hooks.
4. Marketing generatePhase reads `rejectFeedback` and prepends to kbContext.
5. Verify by manually approving and rejecting a review task and confirming KB markings + new generate task respectively.

Rollback: revert. Hooks are opt-in.

## Open Questions

- Should the captain be able to approve a review task while flagging it as "save but don't ship" (skip KB marking)? Maybe — but that's a per-platform draft-status decision, not a review-level one. Leave the all-or-nothing approve for now.
- On reject, should we kill the existing draft directory? Marketing-pipeline original does. My port can copy that behavior — but it loses the prior attempt for inspection. Keep drafts on disk; mark them rejected.
