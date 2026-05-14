## Context

Today's processor:

```ts
const tasks = await listTasks();
for (const task of tasks) {
  if (task.status !== "pending") continue;
  // ... dispatch
  await runPhase(pipeline, phase, task);
}
```

Every pending task runs in one HTTP request to `/api/cron`. SvelteKit's adapter-node has no per-request time limit (good), but the 5-min cron repeats whether or not the previous run finished — and curl from cron has its own default timeout that will silently kill subsequent firings.

The backpressure cap protects against `needs_review` accumulation. It does NOT throttle the pending lane. That's this change.

## Goals / Non-Goals

**Goals:**
- One `/api/cron` invocation never runs more than N tasks (default 3). The remainder sits pending for the next tick.
- The per-tick cap is global (env var) with per-pipeline override (config).
- Older pending tasks process first so the queue doesn't suffer head-of-line blocking by fresh fan-out.
- The `/tasks` UI surfaces "deferred" state so the captain sees the queue draining over multiple ticks, not stuck.

**Non-Goals:**
- Concurrent dispatch within a tick. The processor stays sequential — concurrency would require thinking about lock-on-task races and shared resources (the filesystem-based task store, claude CLI process count). Out of scope here.
- Per-phase caps (e.g. "max 2 generate phases per tick"). Per-pipeline is enough for this iteration.
- Distributed processing. Single-node dashboard remains the only consumer.

## Decisions

**1. Default cap = 3.** A typical marketing generate task is ~3-5 min (six parallel platform claude calls). At cap 3, one tick takes ~15 min worst case. The cron fires every 5 min, so the next tick starts ~5 min after the current one ends — the queue drains continuously without overlapping requests in flight. Lower caps drain slower; higher caps risk overlap. Alternative considered: cap by elapsed time rather than task count. Rejected — predicting phase duration is brittle.

**2. Env var + per-pipeline override.** `PROCESSOR_PER_TICK_CAP` defaults to 3. `PipelineConfig.perTickCap?: number` lets cheap pipelines (software-factory-housekeeping, vault-nuggets after warmup) declare a higher cap. Software-factory-housekeeping can safely set `perTickCap: 50` because it's pure file ops.

**3. FIFO selection within the pending bucket.** Tasks with older `createdAt` go first. Within the same tick, this means: a captain-approved discovery generates 53 fan-out tasks at time T; an hour later (T+1h), a new discovery approval generates 53 more. The first 53 drain before the second 53 start, because creation timestamps order them. This matches captain expectations: "what I approved first, I see first."

**4. Cap is shared across pipelines per tick.** The 3-task cap is a TOTAL budget per tick, not per pipeline. If marketing has 53 pending and competitors has 1, the competitors task runs first (FIFO, older), and 2 marketing tasks run, leaving 51 marketing deferred. Alternative: round-robin per pipeline. Rejected — FIFO is simpler and matches user mental model; round-robin is a fix for a fairness problem we don't have yet (only one pipeline ever fans out heavily).

**5. `paused_backpressure` resume is NOT counted against the cap.** Resuming a paused task transitions it back to `pending` and lets the FIFO order decide. Otherwise resume could starve.

## Risks / Trade-offs

- [Risk] Long queues drain slowly. 53 tasks at cap 3 = ~18 ticks = ~90 min minimum to clear. → Mitigation: per-pipeline override; the captain can bump marketing's cap during a planned content sprint.
- [Risk] Cap-of-3 surprises a captain expecting "fire 10 housekeeping tasks, all 10 run immediately." → Mitigation: software-factory-housekeeping declares `perTickCap: 50`; cheap pipelines won't be throttled.
- [Risk] Per-tick cap and backpressure cap interact non-obviously. → Mitigation: docs in `pipelines/<name>/pipeline.config.ts` comments; `/tasks` UI shows both states distinctly.

## Migration Plan

1. Implement processor cap + env var + per-pipeline override.
2. Add per-pipeline override to `software-factory-housekeeping` (perTickCap: 50) so housekeeping stays fast.
3. Add `deferred` count to processor return + `/tasks` page banner.
4. Verify in dev: create 10 test-pipeline tasks, fire /api/cron, observe 3 run + 7 deferred. Fire again, 3 more run + 4 deferred. Etc.

Rollback: revert one commit. No data migration.

## Open Questions

- Should the cap apply to deterministic-gate retries? Today a slop-check retry counts against the cap (it gets re-set to pending). Likely yes — retries are still work. Decision: yes, retries count.
- Should the captain be able to "drain now" via a button that ignores the cap for one tick? Useful for catching up after the dashboard was down. Defer — not needed if cap defaults are sensible.
