## Why

Marketing discovery's `fanOut` (introduced in commit `2793f31`) creates one generate task per candidate. Today a single discovery approval surfaces 53 candidates and approve advances **all 53**. Each becomes 6 platform claude calls — ~$2-5 in tokens per discovery approval, plus hours of dashboard time. The captain has no way to pick a subset.

The audit (post `2793f31`) flagged this as P1. It's not a bug — fanOut is doing what it's told — but the UX is "53-or-nothing" and that's not how the captain wants to work.

## What Changes

- The discovery task's `needs_review` surface (currently a generic task-detail page) gains a per-candidate selector: list every candidate with title, score, hook, tags, and a checkbox.
- An approval-with-selection action: `POST /api/tasks/:id/approve` accepts an optional `{ selectedCandidateIds: string[] }` body. Without the body, the existing "approve all" behavior is preserved (backwards-compat for the test-pipeline approval path).
- The processor's fanOut signature stays the same `(task) => Promise<Record<string, unknown>[]>`, but receives an enriched task whose `input.approvalSelection?: string[]` field is populated when the captain selected a subset. Marketing's discovery `fanOut` consults that field; if absent, falls back to "all candidates".
- A "select all / select none / select top N by score" helper row on the picker UI for fast batch-action.

## Capabilities

### New Capabilities
- `candidate-selection-ui`: per-candidate review surface for needs_review tasks whose output contains a `candidates[]` array; captain selects which advance via fanOut

### Modified Capabilities
- `marketing-pipeline`: discovery's fanOut returns only selected candidates when `task.input.approvalSelection` is set

## Impact

- New SvelteKit route or extension to `/tasks/[id]`: when the task is `needs_review` AND its output has a `candidates: any[]` array, render the picker. Otherwise the existing task-detail view.
- `POST /api/tasks/[id]/approve` payload schema extended (backwards-compat — body is optional).
- `processor.advanceOrComplete` doesn't change directly; the approval action writes the selection to the task's input before triggering advance, and fanOut reads it.
- No data migration. Existing approved discovery tasks (none currently exist post-cleanup) keep "approve-all" semantics.
