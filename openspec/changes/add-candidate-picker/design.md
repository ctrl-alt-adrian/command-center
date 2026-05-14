## Context

The fanOut mechanism is generic in core but the only caller today is marketing's discovery. fanOut runs at approve-time inside `processor.advanceOrComplete`. The captain has zero control over which elements the fanOut returns.

The docx is explicit about candidate selection being a captain decision:
> "Captain approves and the next phase auto-creates, approves with notes that propagate to the next phase, or revises with --resume and revision instructions."

So this isn't a future feature — it's the original intent.

## Goals / Non-Goals

**Goals:**
- The captain reviews discovery candidates one at a time with full context (hook, angle, tags, score, source KB entry link).
- Selection is per-candidate. "Approve all" still works (default).
- Generic-ish: the picker is shown whenever a needs_review task's output has a `candidates[]` array. Future pipelines that emit similar structures get the picker for free.
- Selection persists on the task so the fanOut can read it. If the captain closes the tab and comes back, their selection is still there.

**Non-Goals:**
- Multi-criteria filtering on the picker (only score-sort + select-top-N to start). The captain has ~10-50 candidates per run; manual scan is fine.
- Editing candidate fields (hook, angle, tags) before approval. That's a phase-2 enhancement; for now the captain accepts or rejects each candidate as-is.
- Mid-pipeline candidate insertion (e.g. captain adds a candidate not produced by discovery). Future feature.

## Decisions

**1. Selection lives on the discovery task's `input` as `approvalSelection: string[]`.** Written by the approve endpoint before triggering advance. fanOut reads it. Alternative: pass selection as a separate parameter through processor. Rejected — that bleeds approval-state into core, polluting the abstraction.

**2. fanOut receives the task (already true) — domain decides selection semantics.** Marketing's discovery fanOut filters its candidates list by `task.input.approvalSelection` when present, falls back to "all" when absent. Other future pipelines that use fanOut decide their own contract.

**3. Detection of "this needs_review has a picker" is structural.** If `task.output?.candidates` is an array, the picker renders. No need to add a flag to PhaseConfig — the data shape determines the UI affordance. Alternative: explicit `PhaseConfig.review.kind = 'candidates' | 'plain'`. Rejected — over-engineering for one use case.

**4. Top-N quick action.** Pre-selecting the top 5 by score is the captain's most common action per the docx ("fewer, sharper notes"). The picker has a "select top 5" button next to "select all" / "select none".

**5. Approval payload is optional.** `POST /api/tasks/:id/approve` with no body = approve all (existing behavior). With `{ selectedCandidateIds: [...] }` = approve subset. Both work. Backwards-compat with test-pipeline and any future pipelines that don't use the picker.

## Risks / Trade-offs

- [Risk] Captain selects zero candidates and clicks approve. → Mitigation: fanOut returns empty array → processor completes parent with `fanout_empty` log, no children created. The UI warns "approving with 0 selected will discard this batch."
- [Risk] Captain expects rejecting individual candidates to send them back to discovery for refinement. → Mitigation: out of scope; "reject" = "don't ship this batch." The captain can run discovery again next day.
- [Risk] Score sort isn't always what the captain wants. → Mitigation: show all five scores per candidate (audience / uniqueness / hook / timeliness / personal-relevance) so the captain can override on instinct.

## Migration Plan

1. Add the picker route/component to `/tasks/[id]`. Detect candidate-shape output and render the picker.
2. Extend `POST /api/tasks/:id/approve` to write `approvalSelection` into the task's input before advancing.
3. Update marketing discovery's fanOut to filter by `approvalSelection`.
4. Verify: run discovery, see 53 candidates, select 3, approve. Confirm 3 generate tasks created, 50 candidates skipped.

Rollback: revert the commit. Approve endpoint without a body still works.

## Open Questions

- Should rejection of individual candidates be a thing (mark them "ignored" so the next discovery skips them)? Useful but adds state. Defer to phase 2 of this proposal.
- Should the captain's selection persist across browser sessions before approval? Yes — by writing draft selection to the task's input on each click rather than only on approve. Worth it; small UX win.
