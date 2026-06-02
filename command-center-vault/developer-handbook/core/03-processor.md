# Core 03 — The Processor (`core/lib/processor.ts`)

The processor is the engine. `runProcessor()` is **one tick**: it resumes paused tasks, gathers pending work, plans a dispatch list under the caps, and runs the dispatched phases in parallel. Nothing in core schedules ticks — something outside core (the dashboard, a cron, a script) calls `runProcessor()` on whatever cadence it likes. This page walks a tick step by step, then documents every exported control function.

> Prereqs: [01-data-model.md](01-data-model.md) (types), [02-task-lifecycle.md](02-task-lifecycle.md) (the state machine this implements). Gate internals are in [04-gates.md](04-gates.md).

---

## What a tick returns

```ts
// core/lib/processor.ts:22-28
export interface ProcessorResult {
  processed: number;
  byPipeline: Record<string, number>;
  paused: number;
  resumed: number;
  deferred: number;
}
```

- `processed` — phases actually run this tick.
- `byPipeline` — `processed` broken down by pipeline id.
- `paused` — tasks newly set to `paused_backpressure` this tick.
- `resumed` — `paused_backpressure` tasks flipped back to `pending` this tick.
- `deferred` — pending tasks left in the queue (disabled pipeline, or over a cap).

After each tick this is written to `logs/processor-state.json` (with a `lastRunAt`), best-effort:

```ts
// core/lib/processor.ts:37-48
async function persistProcessorState(result: ProcessorResult): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.writeFile(
      PROCESSOR_STATE_FILE,
      JSON.stringify({ ...result, lastRunAt: nowIso() }, null, 2),
      "utf-8",
    );
  } catch {
    // best-effort; processor state is observability, not correctness
  }
}
```

`readLastProcessorState()` reads it back (returns `null` if missing). The dashboard uses this to show "last tick" stats.

---

## `runProcessor()` — one tick, step by step

```ts
// core/lib/processor.ts:57-58
export async function runProcessor(): Promise<ProcessorResult> {
  const result: ProcessorResult = { processed: 0, byPipeline: {}, paused: 0, resumed: 0, deferred: 0 };
```

### Step 1 — resume backpressure-paused tasks

Before doing anything else, try to un-pause tasks held back by backpressure on a previous tick:

```ts
// core/lib/processor.ts:60-64
const resumedCount = await tryResumePaused();
result.resumed = resumedCount;
```

`tryResumePaused` loads all tasks, filters `paused_backpressure`, and for each (whose pipeline is enabled and **no longer** capped) flips it to `pending`:

```ts
// core/lib/processor.ts:144-160
async function tryResumePaused(): Promise<number> {
  const all = await listTasks();
  const paused = all.filter((t) => t.status === "paused_backpressure");
  let resumed = 0;
  for (const t of paused) {
    const pipeline = getPipeline(t.pipelineId);
    if (!pipeline) continue;
    if (!(await isPipelineEnabled(pipeline.id))) continue;
    if (!(await isCapped(pipeline))) {
      await updateTask(t.id, { status: "pending" });
      resumed++;
      ...
    }
  }
  return resumed;
}
```

Resume happens **regardless of the per-tick cap** — resumed tasks just take their FIFO place and may dispatch this tick or a later one.

### Step 2 — gather pending work, FIFO

```ts
// core/lib/processor.ts:66-71
const allTasks = await listTasks();
const pending = allTasks
  .filter((t) => t.status === "pending")
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
```

Oldest `createdAt` first. `listTasks()` is the 2-second-TTL cached read ([05-task-store.md](05-task-store.md)), so within a tick the list is a consistent snapshot.

### Step 3 — set up the caps

```ts
// core/lib/processor.ts:73-75
const globalCap = globalPerTickCap();
let globalUsed = 0;
const perPipelineUsed: Record<string, number> = {};
```

`globalPerTickCap()` reads the `PROCESSOR_PER_TICK_CAP` env var, falling back to `DEFAULT_PROCESSOR_PER_TICK_CAP` (10) when unset or invalid:

```ts
// core/lib/processor.ts:30-35
function globalPerTickCap(): number {
  const raw = process.env.PROCESSOR_PER_TICK_CAP;
  if (!raw) return DEFAULT_PROCESSOR_PER_TICK_CAP;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROCESSOR_PER_TICK_CAP;
}
```

There are **two** budgets: a single global pool shared by all pipelines that don't override, and an independent per-pipeline budget for any pipeline with `perTickCap` set.

### Step 4 — plan the dispatch list (Phase 1, sync-ish)

The first pass assigns budget and decides each pending task's fate **without running any phase work**. It only awaits `isCapped`/`isPipelineEnabled`:

```ts
// core/lib/processor.ts:80-127
const dispatch: Array<{ pipeline: PipelineConfig; phase: PhaseConfig; task: Task }> = [];

for (const task of pending) {
  const pipeline = getPipeline(task.pipelineId);
  if (!pipeline) {
    await fail(task, `unknown pipeline: ${task.pipelineId}`);
    continue;
  }
  const phase = getPhase(pipeline, task.phaseId);
  if (!phase) {
    await fail(task, `unknown phase: ${task.pipelineId}/${task.phaseId}`);
    continue;
  }

  // Pipeline-level kill switch.
  if (!(await isPipelineEnabled(pipeline.id))) {
    result.deferred++;
    continue;
  }

  if (pipeline.perTickCap != null) {
    const used = perPipelineUsed[pipeline.id] ?? 0;
    if (used >= pipeline.perTickCap) {
      result.deferred++;
      continue;
    }
  } else if (globalUsed >= globalCap) {
    result.deferred++;
    continue;
  }

  if (isFirstPhase(pipeline, phase.id) && (await isCapped(pipeline))) {
    await updateTask(task.id, { status: "paused_backpressure" });
    result.paused++;
    ...
    continue;
  }

  dispatch.push({ pipeline, phase, task });
  if (pipeline.perTickCap != null) {
    perPipelineUsed[pipeline.id] = (perPipelineUsed[pipeline.id] ?? 0) + 1;
  } else {
    globalUsed++;
  }
}
```

The order of checks matters:

1. **Unknown pipeline/phase** → fail immediately (a task pointing at code that no longer exists is dead).
2. **Kill switch** (`isPipelineEnabled`) — disabled pipelines defer all their pending tasks; tasks stay `pending`.
3. **Cap** — per-pipeline `perTickCap` if set, otherwise the global pool. Over budget → defer.
4. **Backpressure** — only first-phase tasks, only when `isCapped`. → `paused_backpressure`.
5. Else dispatch and consume one unit of the appropriate budget.

### `isCapped` — the backpressure predicate

```ts
// core/lib/processor.ts:162-167
async function isCapped(pipeline: PipelineConfig): Promise<boolean> {
  const cap = pipeline.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP;
  const inPipeline = await listTasksByPipeline(pipeline.id);
  const needsReviewCount = inPipeline.filter((t) => t.status === "needs_review").length;
  return needsReviewCount >= cap;
}
```

Caps on the number of tasks sitting in `needs_review`. The intuition: don't keep starting *new* runs when the captain already has a pile to review. `backpressureCap` defaults to 5.

### Step 5 — run dispatched phases in parallel (Phase 2)

```ts
// core/lib/processor.ts:132-141
await Promise.all(
  dispatch.map(async ({ pipeline, phase, task }) => {
    await runPhase(pipeline, phase, task);
    result.processed++;
    result.byPipeline[pipeline.id] = (result.byPipeline[pipeline.id] ?? 0) + 1;
  }),
);

await persistProcessorState(result);
return result;
```

All dispatched phases fire concurrently with `Promise.all`. Note: **the per-tick cap bounds how many phases start, but actual Anthropic-API concurrency is bounded separately** by the semaphore inside [`claude.ts`](06-claude-wrapper.md) (`CLAUDE_CONCURRENCY`, default 8). The `Promise.all` here just lets independent task work overlap instead of serializing the loop.

> See [the Node docs on `Promise.all`](https://nodejs.org/api/) and async concurrency for the mechanics.

---

## `runPhase` — execute one phase

```ts
// core/lib/processor.ts:169-206
async function runPhase(pipeline: PipelineConfig, phase: PhaseConfig, task: Task): Promise<void> {
  await updateTask(task.id, { status: "running" });
  const startedAt = nowIso();
  ...
  try {
    let output: Record<string, unknown> | undefined;
    if (phase.run) {
      const dir = phaseDir(task.id, phase.id);
      await fs.mkdir(dir, { recursive: true });
      const result = await phase.run(task, {
        taskDir: taskDir(task.id),
        inputDir: prevPhaseDir(pipeline, phase, task),
        outputDir: dir,
        log: (msg, data) => consoleLog("phase_log", { taskId: task.id, phaseId: phase.id, msg, data }),
      });
      output = result.output;
      if (output) {
        await writePhaseOutput(task.id, phase.id, JSON.stringify(output, null, 2), output);
      }
    }
    await updateTask(task.id, { output });
    await applyGate(pipeline, phase, task, startedAt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "error", reason: msg });
    if (err instanceof RateLimitError) {
      await updateTask(task.id, { status: "pending" });
      ...
      return;
    }
    await fail(task, msg);
  }
}
```

Sequence:

1. Set `running`.
2. If `phase.run` exists: `mkdir` the phase dir, build the [`PhaseContext`](01-data-model.md) (note `inputDir` is the **previous** phase's dir), call `run()`.
3. Persist `result.output` to disk (`output.md` + `meta.json`) and onto the task.
4. Hand off to `applyGate` (see [04-gates.md](04-gates.md)).
5. On throw: append an `error` attempt; if it's a `RateLimitError`, requeue to `pending` (no fail); otherwise `fail`.

### `prevPhaseDir`

```ts
// core/lib/processor.ts:208-212
function prevPhaseDir(pipeline: PipelineConfig, phase: PhaseConfig, task: Task): string {
  const idx = pipeline.phases.findIndex((p) => p.id === phase.id);
  if (idx <= 0) return taskDir(task.id);
  return phaseDir(task.id, pipeline.phases[idx - 1].id);
}
```

For the first phase (idx 0) the "input dir" is the task root; otherwise it's the prior phase's output directory. This is the on-disk hand-off between phases.

---

## `advanceOrComplete` — the forward step

```ts
// core/lib/processor.ts:306-368
async function advanceOrComplete(pipeline, phase, task): Promise<void> {
  const next = nextPhase(pipeline, phase.id);
  if (!next) {
    await updateTask(task.id, { status: "completed" });
    ...
    return;
  }
  const fresh = await getTask(task.id);
  const singleAdvanceInput = { ...task.input, ...(fresh?.output ?? {}), previousTaskId: task.id };

  if (phase.fanOut) {
    const elements = await phase.fanOut(fresh ?? task);
    if (elements.length === 0) {
      await updateTask(task.id, { status: "completed" });
      ...
      return;
    }
    const fanOutBase = { ...task.input, previousTaskId: task.id };
    const batchSize = pipeline.fanOutBatchSize ?? elements.length;
    let pendingCount = 0;
    let pausedCount = 0;
    for (let i = 0; i < elements.length; i++) {
      const status = i < batchSize ? "pending" : "paused_user";
      await createTask({
        pipelineId: pipeline.id,
        phaseId: next,
        input: { ...fanOutBase, ...elements[i] },
        parentId: task.parentId ?? task.id,
        status,
      });
      if (status === "pending") pendingCount++;
      else pausedCount++;
    }
    await updateTask(task.id, { status: "completed" });
    ...
    return;
  }

  // Default: single next-phase task as a child.
  await createTask({
    pipelineId: pipeline.id,
    phaseId: next,
    input: singleAdvanceInput,
    parentId: task.parentId ?? task.id,
    status: "pending",
  });
  await updateTask(task.id, { status: "completed" });
  ...
}
```

Three outcomes:

- **Last phase** (`next === null`) → current task `completed`. Done.
- **Single advance** (no `fanOut`) → one child at `next`, `pending`, whose `input` = `{ ...task.input, ...output, previousTaskId }`. The current task is then `completed`. **The child inherits both input and output.**
- **Fan-out** → one child per element. Each child's `input` = `{ ...task.input, previousTaskId, ...element }`. **Fan-out children deliberately do NOT inherit the parent's `output`** (to avoid copying huge discovery arrays into every child — see the in-code comment). First `fanOutBatchSize` children are `pending`, the rest `paused_user`. Empty array → current task just `completed`.

`parentId: task.parentId ?? task.id` chains lineage: the root task's id propagates down so all descendants share a `parentId`.

> Fan-out and batching are also covered from the pipeline author's perspective in [`../pipelines/00-index.md`](../pipelines/00-index.md).

---

## `fail`

```ts
// core/lib/processor.ts:370-374
async function fail(task: Task, msg: string): Promise<void> {
  await updateTask(task.id, { status: "failed", error: msg });
  ...
}
```

---

## Exported control functions

These are the captain's levers. The dashboard API ([`../dashboard/03-api-endpoints.md`](../dashboard/03-api-endpoints.md)) calls them.

### `approveTask(id)` — advance a parked task

```ts
// core/lib/processor.ts:381-395
export async function approveTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "needs_review") return null;
  const pipeline = getPipeline(task.pipelineId);
  if (!pipeline) return null;
  const phase = getPhase(pipeline, task.phaseId);
  if (!phase) return null;
  if (phase.gateType === "deterministic" && task.gateFailReason) {
    ...
    throw new Error(`cannot approve past failed ${phase.id} gate — rerun the gate or reject the task`);
  }
  await advanceOrComplete(pipeline, phase, task);
  return await getTask(id);
}
```

Only acts on `needs_review` tasks. **Refuses** to approve past a deterministic gate that failed (has `gateFailReason`) — that would publish output the gate rejected. Otherwise advances.

### `rejectTask(id, reason?)`

```ts
// core/lib/processor.ts:398-403
export async function rejectTask(id: string, reason?: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task) return null;
  await updateTask(task.id, { status: "failed", error: reason ?? "rejected" });
  return await getTask(id);
}
```

Marks the task `failed` with the reason (defaults to `"rejected"`).

### `rerunTask(id)` — re-queue a failed task

```ts
// core/lib/processor.ts:502-515
export async function rerunTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "failed") return null;
  await updateTask(task.id, {
    status: "pending", error: "", retryCount: 0, gateFailReason: "",
  });
  await clearFailureAttempts(task.id);
  ...
}
```

Only `failed` tasks. Resets to a clean `pending`, drops `error`/`gate_fail` attempts, preserves `ok` history.

### `rerunGate(id)` — re-run an exhausted gate

```ts
// core/lib/processor.ts:459-497
export async function rerunGate(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task) return null;
  if (task.status !== "needs_review") return task;
  if (!task.gateFailReason) return task; // not a gate-exhausted task — refuse

  const pipeline = getPipeline(task.pipelineId);
  const prev = pipeline ? previousPhase(pipeline, task.phaseId) : null;
  const targetPhase = prev ?? task.phaseId;

  await updateTask(task.id, {
    status: "pending",
    phaseId: targetPhase,
    retryCount: 0,
    gateFailReason: "",
  });
  await clearFailureAttempts(task.id);
  ...
}
```

For tasks parked at `needs_review` *because* a deterministic gate exhausted (`gateFailReason` is truthy). It **rewinds to the previous phase** (not just re-checks) because the failing artifact may have been deleted by `onExhausted`; the upstream phase regenerates and auto-advances back through the gate with a fresh budget. See [04-gates.md](04-gates.md).

### `resumePausedUserTasks(pipelineId | undefined, count)`

```ts
// core/lib/processor.ts:408-427
export async function resumePausedUserTasks(
  pipelineId: string | undefined,
  count: number,
): Promise<{ resumed: number; ids: string[] }> {
  if (count <= 0) return { resumed: 0, ids: [] };
  const all = await listTasks();
  const candidates = all
    .filter((t) => t.status === "paused_user")
    .filter((t) => (pipelineId ? t.pipelineId === pipelineId : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, count);
  const ids: string[] = [];
  for (const t of candidates) {
    await updateTask(t.id, { status: "pending" });
    ids.push(t.id);
    ...
  }
  return { resumed: ids.length, ids };
}
```

Drains the next `count` `paused_user` tasks (oldest first) back to `pending`. This is the "Resume next batch" button — it's how fan-out batching is throttled. `undefined` pipelineId drains across all pipelines.

### `disableTask(id)` / `enableTask(id)`

```ts
// core/lib/processor.ts:431-449
export async function disableTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task) return null;
  if (task.status !== "pending" && task.status !== "paused_backpressure") return task;
  await updateTask(task.id, { status: "paused_user" });
  ...
}

export async function enableTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "paused_user") return task;
  await updateTask(task.id, { status: "pending" });
  ...
}
```

`disableTask` reuses `paused_user` so the existing resume/UI plumbing works. It only acts on tasks that haven't started (`pending`/`paused_backpressure`). `enableTask` is the inverse.

### `pipelineStatus()` — dashboard summary

```ts
// core/lib/processor.ts:517-547
export async function pipelineStatus(): Promise<
  Array<{ id: string; phases: ...; backpressureCap: number; enabled: boolean; counts: Record<string, number> }>
> {
  const allTasks = await listTasks();
  const enabledMap = await getAllPipelineEnabledMap();
  ...
  return listPipelines().map((p) => ({
    id: p.id,
    phases: p.phases.map((ph) => ({ id: ph.id, gateType: ph.gateType })),
    backpressureCap: p.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP,
    enabled: enabledMap[p.id] ?? true,
    counts: {
      needs_review: 0, pending: 0, running: 0, completed: 0,
      failed: 0, paused_backpressure: 0, paused_user: 0,
      ...(byPipeline.get(p.id) ?? {}),
    },
  }));
}
```

Builds the per-pipeline status the dashboard renders: phases, backpressure cap, enabled flag, and a status-count histogram (zero-seeded so every common status is present even at 0). Note the seed object omits `cleared_stale` — a pipeline with cleared-stale tasks would still show that key via the spread of `byPipeline`.

### `readLastProcessorState()`

Already shown above — reads `logs/processor-state.json`, returns `null` if absent.

---

## Where to go next

- [04-gates.md](04-gates.md) — `applyGate` in full, the retry/rewind design.
- [05-task-store.md](05-task-store.md) — `createTask`/`updateTask`/`listTasks` and the locking discipline the processor relies on.
- [07-registry-bootstrap.md](07-registry-bootstrap.md) — `getPipeline`/`getPhase`/`nextPhase`/`previousPhase`/`isFirstPhase`.
- [`../dashboard/03-api-endpoints.md`](../dashboard/03-api-endpoints.md) — how ticks and control functions are invoked.
