## 1. Approve endpoint extension

- [ ] 1.1 `dashboard/src/routes/api/tasks/[id]/approve/+server.ts` accepts optional body `{ selectedCandidateIds: string[] }`. When present, write to `task.input.approvalSelection` via `updateTask` BEFORE calling `approveTask`
- [ ] 1.2 Validate the body: array of strings; empty array allowed (the UI guards against accidental empty submits)
- [ ] 1.3 Return shape unchanged so existing UI keeps working

## 2. Selection persistence endpoint

- [ ] 2.1 New `POST /api/tasks/[id]/selection` accepts `{ selectedCandidateIds: string[] }` and writes to `task.input.approvalSelection`. Returns `{ ok: true }`
- [ ] 2.2 Idempotent: calling repeatedly with the same payload is a no-op

## 3. Picker UI

- [ ] 3.1 In `dashboard/src/routes/tasks/[id]/+page.server.ts`, when task is needs_review AND `output.candidates` is a non-empty array, pass the candidates and any `input.approvalSelection` through to the page
- [ ] 3.2 Create `dashboard/src/lib/CandidatePicker.svelte` component: header row (select all / select none / select top N with N input), one row per candidate with checkbox + title + score grid + tags + (optional) link to source KB entry
- [ ] 3.3 Local state `selected: Set<string>`; on toggle, debounce-POST to `/api/tasks/[id]/selection` (300ms)
- [ ] 3.4 In `dashboard/src/routes/tasks/[id]/+page.svelte`: render the picker when candidates exist, plain view otherwise
- [ ] 3.5 Replace the existing single "approve" button with two: "Approve selected (N)" and "Approve all (M)"

## 4. Marketing fanOut update

- [ ] 4.1 `pipelines/marketing/pipeline.config.ts` discoveryPhase.fanOut:
  - Read `task.input.approvalSelection as string[] | undefined`
  - Filter `task.output.candidates` by selection when present
  - Behavior with `approvalSelection: []` is "advance zero candidates" (matches the UI's zero-warning path)
  - Behavior with `approvalSelection: undefined` is "advance all candidates" (legacy)
- [ ] 4.2 Audit other current fanOut consumers — none today

## 5. Verification

- [ ] 5.1 Run marketing discovery → needs_review with 50+ candidates
- [ ] 5.2 Visit `/tasks/<id>`: picker renders with all rows unchecked
- [ ] 5.3 Click "select top 5", confirm 5 highest-totalScore rows check
- [ ] 5.4 Toggle one off, navigate away, navigate back → selection preserved
- [ ] 5.5 Click "Approve selected (4)" → 4 generate tasks created in pending
- [ ] 5.6 Run another discovery, click "Approve all" → all candidates fan out (legacy)
- [ ] 5.7 Tasks without candidate output (e.g. test-pipeline echo result) render the plain detail view, no picker
