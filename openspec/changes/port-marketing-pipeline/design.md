## Context

Marketing-pipeline's `dashboard/src/lib/` mixes generic primitives (now extracted to core in phase 1) with marketing-specific logic: `generate.ts` orchestrates the discovery subagents, `scoring.ts` ranks candidates with 5 weighted criteria, `drafts.ts` manages per-draft metadata, `dedup.ts` does Jaccard similarity, and `signals.ts` loads external trend data. The prompts in `cli/` are marketing-specific. Phase 2 moves only what is marketing-specific into `pipelines/marketing/` and leaves core untouched.

The slop gate is the highest-value piece to model correctly: today it lives mid-pipeline as part of generate. In the new model it is a clean `deterministic` gate with explicit retry semantics — the docx's canonical example of why deterministic gates exist.

## Goals / Non-Goals

**Goals:**
- Bit-for-bit behavioral parity with marketing-pipeline today (same discovery output, same generated drafts, same slop checks, same approval queue) running on command-center's core.
- The marketing pipeline registers itself via one `PipelineConfig`; no edits to `core/lib/`.
- Slop checking becomes a true deterministic gate, retries handled by the processor.
- Drafts editor preserves the per-platform claude refinement loop.

**Non-Goals:**
- Changing scoring weights, slop rules, platform prompts, or KB schema.
- Improving any marketing logic. Faithful port first; iterate later.
- Mutating marketing-pipeline source.

## Decisions

**1. Two-phase generate flow stays.** Discovery and generate remain separate phases — discovery picks candidates (with KB scanner, draft inventory, signal analyzer subagents) and generates a ranked list; the captain approves a candidate via needs_review; then per-platform drafts fan out in parallel under a single `generate` phase. The slop-check gate runs after generate. Alternative considered: collapse discovery+generate. Rejected — the captain's review of candidates before drafting is a real human gate the docx explicitly recommends.

**2. Slop gate as deterministic with retry_policy.maxAttempts = 3.** On fail, the phase is rerun with violation feedback appended to the prompt input file. Matches today's behavior. Alternative: keep slop inside generate and loop internally. Rejected — that hides retries from the captain and from `/tasks`.

**3. Drafts on disk, status in core task store.** Per-draft metadata (`meta.json`, `status.json`) stays alongside the markdown drafts as today. The task store references the draft path; it does not duplicate draft state. Keeps grep-ability.

**4. Platform fan-out as parallel subagents within one phase.** Per the docx primitive: "subagents inside the phase." Generate spawns N claude -p subagents (one per enabled platform) and writes N drafts under the task's output dir. The phase completes when all subagents complete. Alternative: one phase per platform. Rejected — that would 6x the queue depth and confuse the cap.

**5. KB source unchanged.** `VAULT_ROOT` defaults to `~/Documents/rolenext/sessions/` (phase 3 will introduce the proper MACHINE-framework vault but won't break the legacy path).

## Risks / Trade-offs

- [Risk] Core abstraction is missing something marketing needs → Mitigation: this is the validation phase; if core needs to grow, that's fine. Document any addition as a new requirement under phase 1's specs (delta).
- [Risk] Drafts move loses uncommitted captain edits in marketing-pipeline → Mitigation: copy drafts atomically, leave the source intact, only delete after the captain confirms parity.
- [Risk] Cron collision (both apps' crons firing) → Mitigation: archive marketing-pipeline's cron entries in the same commit that installs command-center's. No overlap window.

## Migration Plan

1. Build pipelines/marketing/ on top of phase 1 core.
2. Run command-center on port 3001 in parallel for a few days; the captain works in command-center, marketing-pipeline kept warm as fallback.
3. Copy drafts/ from marketing-pipeline to command-center after a successful end-to-end cycle.
4. Uninstall marketing-pipeline cron entries; install command-center's.
5. Add deprecation note to marketing-pipeline README.

Rollback: re-enable marketing-pipeline cron entries; the source is untouched.

## Open Questions

- Drafts editor: keep current UX exactly, or take this opportunity to add the per-platform regenerate-with-feedback shortcut the captain has asked about? Recommend exact UX first, defer enhancement.
- Should discovery's three subagents (KB scanner, draft inventory, signal analyzer) be three subagents inside one phase, or three sibling phases that fan-in to a synthesis phase? Today they are subagents inside one phase. Keep that — the docx endorses it.
