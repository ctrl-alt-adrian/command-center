## Context

Current processor:

```ts
if (retries < max) {
  await updateTask(task.id, { status: "pending", retryCount: retries, gateFailReason: result.reason });
} else {
  await updateTask(task.id, { status: "needs_review", gateFailReason: result.reason });
}
```

The task stays at the same `phaseId`. For phases that produce on-disk artifacts (drafts, vault notes), re-running the same gate against the same artifacts is pointless. The actual fix has to re-run the **producing** phase with feedback so it produces different artifacts.

Marketing-pipeline solves this by special-casing slop-check in `processor.ts`. We don't want a special case; we want a generic retry-by-rollback knob on the phase config.

## Goals / Non-Goals

**Goals:**
- A deterministic-gate phase can declare `retryFromPhase: "<upstream-phase-id>"` and the processor handles the rollback generically.
- Failure feedback (the gate's `reason` string) reaches the upstream phase via `task.input.gateRetryFeedback`. Upstream phases opt into using it; if they don't, behavior is identical to today.
- `retryPolicy.maxAttempts` semantics carry across rollback — 3 attempts at slop-check still means 3 generate retries, not 3 × N.
- Existing pipelines (vault-nuggets, competitors, reddit-pmf, software-factory) keep working — they don't declare `retryFromPhase` and behavior is unchanged.

**Non-Goals:**
- Rolling back more than one phase. (`retryFromPhase` is a single phase id, not a chain.)
- Rolling back conditional on the failure reason. The retry path is the same for any deterministic-gate fail.
- Persisting full prior outputs across rollback. The fresh task's input carries forward what it needs (kbContext, candidate, gateRetryFeedback); the previous draft directory etc. is left on disk as audit but isn't re-used.

## Decisions

**1. Field name: `retryFromPhase`.** Reads naturally: "on retry, start from generate phase." Alternative considered: `rollbackTo`. Rejected — implies destruction; the prior task lineage is preserved.

**2. Feedback field name: `gateRetryFeedback`.** Generic. Marketing's generate reads it as a slop-violation string. Future pipelines (vault-nuggets if it ever gains a deterministic gate) could read it as something else. Alternative: `slopFeedback`. Rejected — domain-specific in a core abstraction.

**3. Retry counter persists across rollback.** The failed slop-check task gets `failed` status with `rollback_to: <new-id>` annotation. The new generate task inherits `retryCount + 1` from the failed slop-check. When the next slop-check fails, it sees `retryCount = 1` and decides whether to rollback again or escalate to needs_review. Alternative: reset retryCount on rollback. Rejected — would allow infinite cycles.

**4. Pipeline registry validation.** When a pipeline is registered, validate that any `retryFromPhase` points at a phase that exists earlier in `phases[]`. Caught at boot, not at runtime.

**5. Single-phase rollback only.** `retryFromPhase` is a string, not a path. If marketing later adds a phase between generate and slop-check (e.g. "humanize"), the captain decides whether slop-check should roll back to generate or humanize — by editing the config, not by walking the chain.

## Risks / Trade-offs

- [Risk] Infinite rollback loops. → Mitigation: retryCount persists; `retryPolicy.maxAttempts` (default 3) caps total attempts including rollbacks.
- [Risk] Captains may misconfigure `retryFromPhase` to point forward instead of backward. → Mitigation: validator at registry-bootstrap time. Index check: `phases.indexOf(retryFromPhase) < phases.indexOf(currentPhase)`.
- [Risk] Audit trail confusion — failed task X "becomes" task Y via rollback. → Mitigation: `error: "rolled back to <new-id>"`, plus the new task has `parentId` chained to the original ancestor. /tasks/[id] UI shows the rollback chain.

## Migration Plan

1. Add `retryFromPhase` to `PhaseConfig`. Validate at registry time.
2. Modify processor's gate-fail branch: detect `retryFromPhase`, perform rollback, persist retry counter.
3. Marketing slop-check declares `retryFromPhase: "generate"`. Marketing generate reads `task.input.gateRetryFeedback` and appends it to kbContext when present.
4. Verify in dev: manually craft a draft that violates slop (e.g. contains "delve"), trigger slop-check, observe rollback → fresh generate → new draft → slop passes (or hits cap and goes to needs_review).
5. No data migration. Existing tasks unchanged.

Rollback: revert the commit. `retryFromPhase` is opt-in; absent it, behavior matches today.

## Open Questions

- Should `slopFeedback` (the old field name in my marketing port) be preserved as an alias for backwards compat, or rename it cleanly? Recommend rename. The current `slopFeedback` reference is dead code (never populated).
- Should retryCount reset on a successful pass? Today retryCount doesn't reset; it carries forever. For slop retry that's probably fine (3-strikes-and-needs-review). Leave as-is; revisit if it bites.
