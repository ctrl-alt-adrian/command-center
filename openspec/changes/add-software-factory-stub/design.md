## Context

A multi-domain abstraction that has only ever been used by one domain is unproven. Phase 6 makes the second domain real, even if its first inhabitant is small. The choice of "daily housekeeping" as the validator is deliberate: it's a software-factory-shape task (the system maintaining itself), it touches core's task store (proving cross-domain access works), and it produces a visible side effect (cleared paused-backpressure tasks) so the captain can verify it's running.

The future software-factory pipelines that this phase reserves space for (spec-to-PR, test-triage, dep-bump) are the real prize; the captain has talked about them but is not building them today. The point of phase 6 is to ensure that when the captain WANTS to build them, the path is "drop a config and a prompt" not "rework the core".

## Goals / Non-Goals

**Goals:**
- `/software-factory` route exists in the dashboard, distinct from `/marketing`, `/competitors`, `/vault`, `/reddit-pmf`.
- `pipelines/software-factory/` contains a working pipeline that does real work.
- A new captain (or agent) opening this folder can read the README, copy the pattern, and ship a new pipeline without touching `core/`.
- Daily-housekeeping actually clears stale paused tasks. Not a no-op stub.

**Non-Goals:**
- Implementing spec-to-PR, test-triage, or any other ambitious software-factory pipeline. Those are their own future proposals.
- Auto-deleting tasks the captain might still want. Clearing rules are conservative; only `paused_backpressure` > 7 days, with a logged reason.
- A general "system maintenance" framework. One pipeline, narrow scope.

## Decisions

**1. Daily-housekeeping is the validator.** Alternative: a hello-world stub. Rejected — a stub that does nothing doesn't validate anything. Daily-housekeeping is small but real.

**2. Symlink `~/Developer/projects/software-factory/` → `command-center/pipelines/software-factory/`.** Alternative: leave the source dir empty and only use command-center's path. Rejected — the symlink preserves the captain's mental model that "software-factory" is a project, while making command-center the canonical implementation.

**3. `auto_pass` gate, not needs_review.** Housekeeping is mechanical and reversible (the log records what was cleared); needs_review here would just be friction. The docx says to reserve auto_pass for mechanically safe phases. Clearing paused tasks > 7 days qualifies.

**4. Per-domain dashboard route, shared queue.** `/software-factory` shows only software-factory pipelines and tasks, but the underlying task queue is the same `/tasks` global view. Alternative: separate task store per domain. Rejected — defeats the Command Center premise.

**5. Future pipelines reserved-but-empty.** The README enumerates the obvious future candidates (spec-to-PR, test-triage, dep-bump) with one paragraph each describing what they would do. No code. This is a planning anchor, not a commitment.

## Risks / Trade-offs

- [Risk] Daily-housekeeping is too small to prove the multi-domain pattern → Acknowledged. If phase 6 ships and the abstraction still feels wrong, that's a phase-1 design issue, not a phase-6 issue.
- [Risk] Symlink makes the source dir confusing → Mitigation: a `README.md` in `~/Developer/projects/software-factory/` redirecting readers to command-center.

## Migration Plan

1. Add `/software-factory` route and the empty `pipelines/software-factory/` folder.
2. Ship `daily-housekeeping` pipeline.
3. Run it for a week and confirm it clears stale tasks correctly.
4. Symlink the legacy directory.
5. Write the README enumerating future pipelines.

Rollback: delete `pipelines/software-factory/`, route, cron entry. Remove the symlink.

## Open Questions

- Are there other "system self-maintenance" candidates worth bundling into daily-housekeeping (e.g. trim drafts older than 90 days, prune signals/competitors archives older than 60 days)? Recommend deferring; keep the validator narrow.
- Should `/software-factory` include a status page showing each future-reserved pipeline as `not yet implemented`? Probably yes — visibility into what is reserved keeps the captain oriented.
