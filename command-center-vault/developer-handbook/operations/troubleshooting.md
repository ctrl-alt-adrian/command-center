# Operations — Troubleshooting

A practical runbook for the failure modes you'll actually hit. Each entry: the
symptom, why it happens (with the code path), and what to do.

## First, two places to look

1. **`logs/processor-state.json`** — the last tick's counts and timestamp. Quick
   liveness check. Written at the end of every tick:

   ```ts
   // core/lib/processor.ts
   await fs.writeFile(PROCESSOR_STATE_FILE,
     JSON.stringify({ ...result, lastRunAt: nowIso() }, null, 2), "utf-8");
   ```

   The shape is `{ processed, byPipeline, paused, resumed, deferred, lastRunAt }`.
   If `lastRunAt` is stale (more than a couple minutes old), the heartbeat isn't
   firing — jump to "Dashboard down".

2. **`logs/processor-<date>.log`** — the JSONL event log, one file per day. Every
   phase start, gate decision, rewind, fan-out, requeue, and failure is a line
   here (`{ ts, kind, ... }`). Grep it by `kind` (`phase_start`, `failed`,
   `gate_rewind`, `gate_exhausted`, `rate_limited_requeue`, `fanned_out`,
   `paused_backpressure`, `resumed`, …). See [../core/10-utilities.md](../core/10-utilities.md).

The `/tasks` dashboard page surfaces most of this visually, including a Failures
panel.

## Dashboard down → cron silently fails (no alarm)

**Symptom:** nothing advances; `processor-state.json` `lastRunAt` goes stale.

**Why:** the cron lines curl the dashboard with output redirected to
`/dev/null 2>&1`. If the dashboard process isn't running (or `PORT` is wrong),
the curl fails and **nothing logs it**. There is no alerting. This is a known
gap.

**Fix:** confirm the dashboard is up (`curl -s http://localhost:3001/`), restart
it (`cd dashboard && npm run dev`), and confirm the OS cron daemon is running.
See [cron-and-scheduling.md](cron-and-scheduling.md).

## Tasks stuck in `pending`

Several distinct causes — check in this order:

1. **Per-tick cap.** Only `PROCESSOR_PER_TICK_CAP` (or a pipeline's `perTickCap`)
   tasks dispatch per tick; the rest stay `pending` and are reported as
   `deferred`. This is **normal** for a big fan-out — they drain over subsequent
   ticks in `createdAt` (FIFO) order. The `/tasks` banner shows "N deferred to
   next tick". See [../core/03-processor.md](../core/03-processor.md) and
   [configuration.md](configuration.md).

2. **Pipeline disabled (kill switch).** If a pipeline is toggled off, its pending
   tasks are skipped (counted as `deferred`) and stay `pending` until re-enabled:

   ```ts
   // core/lib/processor.ts
   if (!(await isPipelineEnabled(pipeline.id))) {
     result.deferred++;
     continue;
   }
   ```

   The switch lives in `logs/pipeline-state.json` (default = enabled). Re-enable
   from the `/tasks` UI or by editing that file. See
   [../core/10-utilities.md](../core/10-utilities.md).

3. **Dashboard not being poked.** If the heartbeat isn't firing at all, see
   "Dashboard down" above.

## Tasks stuck in `paused_backpressure`

**Symptom:** first-phase tasks for a pipeline park as `paused_backpressure`.

**Why:** the **backpressure cap** counts `needs_review` tasks per pipeline. When
a pipeline already has `backpressureCap` (default **5**) tasks awaiting captain
review, new first-phase tasks are paused rather than piling more onto the review
queue:

```ts
// core/lib/processor.ts
async function isCapped(pipeline) {
  const cap = pipeline.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP; // 5
  const inPipeline = await listTasksByPipeline(pipeline.id);
  const needsReviewCount = inPipeline.filter((t) => t.status === "needs_review").length;
  return needsReviewCount >= cap;
}
```

**Fix:** review and clear the `needs_review` queue (approve/reject). Each tick
first tries to resume paused tasks once the cap clears
(`tryResumePaused`). Old `paused_backpressure` tasks that linger are candidates
for the software-factory housekeeping sweep, which moves stale tasks to
`cleared_stale` — see [../pipelines/software-factory.md](../pipelines/software-factory.md).

## Tasks stuck in `paused_user` (fan-out batches)

**Symptom:** after approving a discovery, only the first N children run; the rest
sit as `paused_user`.

**Why:** this is the `fanOutBatchSize` throttle working as designed. When a phase
fans out, the first `fanOutBatchSize` children are created `pending` and the rest
`paused_user`, so one approval doesn't spawn hundreds of `claude` calls at once:

```ts
// core/lib/processor.ts
const batchSize = pipeline.fanOutBatchSize ?? elements.length;
for (let i = 0; i < elements.length; i++) {
  const status = i < batchSize ? "pending" : "paused_user";
  // createTask({ ..., status })
}
```

**Fix:** click **"Resume next batch"** on `/tasks` (or the pipeline page), which
calls `POST /api/tasks/resume {pipelineId, count}` → `resumePausedUserTasks`,
flipping the next N `paused_user` tasks (oldest first) back to `pending`. Default
count is 25. See [../core/03-processor.md](../core/03-processor.md).

> `paused_user` is also reused for manually **disabled** pending tasks
> (`disableTask`). Re-enable from the UI (`enableTask`).

## Rate limits

**Symptom:** a `claude` phase hits an Anthropic rate limit / overload.

**Why & behavior:** `claude.ts` detects rate-limit text in stdout/stderr and
throws a `RateLimitError`. The processor **does not fail** the task — it requeues
it to `pending` so the next tick retries:

```ts
// core/lib/processor.ts
if (err instanceof RateLimitError) {
  await updateTask(task.id, { status: "pending" });
  // logs "rate_limited_requeue"
  return;
}
```

**Fix:** usually nothing — it self-heals on the next tick. If it's persistent,
lower `CLAUDE_CONCURRENCY` (default 8) or thin out the active pipelines. See
[../core/06-claude-wrapper.md](../core/06-claude-wrapper.md).

## "cannot approve past failed gate" (HTTP 409)

**Symptom:** clicking Approve on a `needs_review` task errors with
`cannot approve past failed <phase> gate — rerun the gate or reject the task`.

**Why:** the task is `needs_review` because a **deterministic** gate exhausted
its retries (it has `gateFailReason` set). Approving would publish output the
gate explicitly rejected, so `approveTask` refuses:

```ts
// core/lib/processor.ts
if (phase.gateType === "deterministic" && task.gateFailReason) {
  throw new Error(`cannot approve past failed ${phase.id} gate — rerun the gate or reject the task`);
}
```

**Fix:** either
- **Rerun the gate** — `rerunGate` rewinds to the previous phase, clears
  `gateFailReason`, and re-runs the upstream artifact through the gate with a
  fresh budget. Use this after you've fixed the upstream artifact (e.g. edited a
  draft the slop gate reads). Or
- **Reject** the task (`rejectTask`).

See [../core/04-gates.md](../core/04-gates.md).

## `claude` binary not on PATH

**Symptom:** every generative phase fails with an `claude -p ... failed` error
(often `exit 127` / "command not found").

**Why:** `claude.ts` shells out to `claude` via `execFile("claude", ...)`. If the
dashboard process's `PATH` doesn't include the directory holding `claude`, every
call fails. This bites especially when the dashboard is launched from a minimal
environment (a bare cron/systemd context) that doesn't inherit your interactive
shell's PATH.

**Fix:** ensure `claude` (and `yt-dlp`, `gh`, `git`) are resolvable from the
environment that launches `npm run dev` / the adapter-node server. Confirm with
`which claude` in that same shell. See [../03-getting-started.md](../03-getting-started.md).

## Re-running and clearing

- **Re-run a failed task:** `rerunTask` — flips `failed` → `pending`, clears the
  error and retry counter, preserves the `attempts` history.
- **Re-run an exhausted gate:** `rerunGate` (above).
- **Clear failures / terminal tasks:** the clear endpoint accepts only `failed`,
  `completed`, and `cleared_stale` statuses (`api/tasks/clear`). It removes them
  from the store so the dashboard stays readable.

> Per project convention, the action buttons (approve, reject, rerun, clear)
> have **no confirm dialog** — clicking the button is the confirmation.

## See also
- [../core/02-task-lifecycle.md](../core/02-task-lifecycle.md) — every status and transition.
- [../core/03-processor.md](../core/03-processor.md) — the tick, caps, fan-out.
- [cron-and-scheduling.md](cron-and-scheduling.md) — the heartbeat.
- [configuration.md](configuration.md) — caps and concurrency knobs.
