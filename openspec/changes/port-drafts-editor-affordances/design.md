## Context

Marketing-pipeline's drafts editor has been the captain's primary daily-work surface. Each platform tab has: the markdown, a slop panel, Refine button (claude refinement), Regenerate (claude redo for that platform), Slop-check, and a status dropdown. My port shipped only the markdown view.

These actions don't go through the pipeline task queue. They're direct mutations on disk that the captain performs **between** generate and review — to polish copy before final approval. The task queue and these editor actions are orthogonal concerns.

## Goals / Non-Goals

**Goals:**
- Bit-for-bit feature parity with marketing-pipeline's editor for refine / regenerate / slop / status.
- Refinement uses the same voice guardrails as initial generation (loaded from a shared prompt file).
- Mutations are immediate and visible — no task queue, no pending state, fast UX.
- Errors surface inline so the captain doesn't lose work.

**Non-Goals:**
- Multi-draft batch operations (refine all platforms with the same instruction). Per-platform only.
- Undo. The captain can re-Refine with reverting instructions or Regenerate to nuke.
- Auto-saving captain edits to the markdown textarea. Editor remains read-only-with-actions for now.

## Decisions

**1. Endpoints are domain-scoped under `/api/marketing/drafts/`.** Other domains may later get their own editor surfaces (vault notes, reddit landing pages). Cleaner to scope per domain than overload `/api/drafts`. Alternative: generic `/api/drafts/<domain>/...`. Rejected — premature abstraction.

**2. Refine sends current content + instruction to claude.** The prompt is `cli/refine-post.md`. It includes the shared voice rules + a "your job: apply the instruction" framing. The captain types instructions like "make the opening punchier" or "shorten by 30%."

**3. Regenerate uses the same per-platform generation logic.** Refactor or expose `pipelines/marketing/lib/generate.ts`' inner per-platform function. Today `generateDrafts` does all platforms; we'll add a `generateSinglePlatform(platform, topic, kbContext, ...)` helper.

**4. Slop-check is the same engine.** Just runs `runRules(content, MARKETING_SLOP_PACK)` for the requested platform(s) and returns the violations.

**5. Status updates write `status.json` directly.** Same pattern as marketing-pipeline. Setting a draft to `posted` doesn't trigger pipeline events — it's metadata.

**6. The editor UI mutates local state optimistically.** Each action POSTs, on success swaps in the response content, on error shows a banner and keeps the prior content. No full page reload.

## Risks / Trade-offs

- [Risk] Refine returns garbage / fails slop / accidentally truncates. → Mitigation: after refine, the response includes the fresh slop result; UI shows it inline so captain can re-refine or revert via regenerate.
- [Risk] Regenerate loses captain edits that haven't been saved. → Mitigation: there's no captain-editable textarea yet (read-only viewer). Future enhancement could add a textarea + save endpoint.
- [Risk] Slop pack not loaded when slop-check endpoint is called. → Mitigation: endpoint calls `loadMarketingSlopPack()` (idempotent — registerSlopPack overwrites).

## Migration Plan

1. Author `cli/refine-post.md`.
2. Refactor `generate.ts` to expose `generateSinglePlatform`.
3. Add four endpoints under `dashboard/src/routes/api/marketing/drafts/[date]/`.
4. Extend `/marketing/drafts/[slug]/+page.svelte` with the four controls.
5. Verify each action against a real draft set (the captain can drag-drop a sample if needed).

Rollback: revert the commit. Editor returns to read-only.

## Open Questions

- Should the editor also support a captain-typed textarea (full manual edit)? Phase 2 spec didn't explicitly require it, but it's a clear future-want. Defer.
- Should refine show a diff between old and new? Nice but not blocking — captain sees old content above, types instruction, sees new content. Diff is phase 2 of this proposal.
- Per-platform regenerate currently can't change the angle/hook (those come from the candidate). Should it? Useful for "this hook isn't landing — try angle X." Allow optional override via the regenerate payload.
