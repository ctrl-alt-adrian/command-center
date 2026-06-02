# Dashboard 04 — Full-Stack Trace

> The centerpiece. This page walks **one feature end-to-end** — the Tasks page and the Approve action — so you can see exactly how the thin SvelteKit shell and the file-based engine in [`../core/`](../core/03-processor.md) fit together. Then it traces the **heartbeat** (OS cron → one processor tick). Internalize this and the rest of the dashboard is just repetition of the same shape.
>
> **The one idea to keep:** the dashboard holds **no state**. Every `load` reads the engine fresh. Every button POSTs an endpoint that calls one engine function and then re-reads via `invalidateAll()`. State lives in `task.json` files on disk, not in the browser.

---

## Part A — The Tasks page, load → render → action

### A1. `load` (server) — read the engine

When the browser requests `/tasks`, SvelteKit runs `tasks/+page.server.ts` **on the Node server**. It fans out four reads in parallel and assembles `data`:

```ts
import { listTasks } from "../../../../core/lib/tasks.ts";
import { pipelineStatus, readLastProcessorState } from "../../../../core/lib/processor.ts";
import { extractFailures } from "$lib/failures";

export async function load() {
  const [tasks, pipelines, lastProcessor] = await Promise.all([
    listTasks(),              // every task.json on disk → Task[]
    pipelineStatus(),         // registry + counts per pipeline
    readLastProcessorState(), // last /api/cron tick summary
  ]);
  const failures = extractFailures(tasks);   // pure transform, no I/O
  return { tasks, pipelines, lastProcessor, failures };
}
```

What each call reaches:
- `listTasks()` → [`../core/05-task-store.md`](../core/05-task-store.md): walks the tasks dir, reads each `task.json`, returns `Task[]`.
- `pipelineStatus()` → [`../core/03-processor.md`](../core/03-processor.md): reads the registry (populated at boot by `bootstrapPipelines()`, [01 §6](./01-stack-and-bootstrap.md#6--server-bootstrap--hooksserverts-the-critical-bit)) and tallies per-pipeline status counts + `backpressureCap` + `enabled`.
- `readLastProcessorState()` → the persisted summary of the most recent tick (`processed`, `deferred`, `lastRunAt`).
- `extractFailures(tasks)` → `$lib/failures` ([05](./05-components-and-patterns.md)): pure, derives the Failures panel rows from the tasks already in hand — **no extra disk read**.

The return value is serialized and handed to the page component.

### A2. render — `$props()`, `$derived`, polling `$effect`

`tasks/+page.svelte` receives `data` via Svelte 5 `$props()` and derives its view:

```svelte
let { data } = $props();
let filter = $state<"all" | "pending" | … >("all");

$effect(() => {
  const id = setInterval(() => invalidateAll(), 3000);
  return () => clearInterval(id);
});

const visibleTasks = $derived(
  filter === "all" ? data.tasks : data.tasks.filter((t) => t.status === filter),
);
```

- `data.tasks` drives the table; `data.pipelines` drives the per-pipeline control cards; `data.failures` drives the `<Failures>` panel.
- `visibleTasks` is `$derived` from `data.tasks` + the local `filter` `$state` — it recomputes automatically whenever either changes ([Svelte 5 `$derived`](https://svelte.dev/docs/svelte/$derived)).
- The `$effect` schedules `invalidateAll()` every **3 s** ([`$effect` docs](https://svelte.dev/docs/svelte/$effect)). `invalidateAll()` re-runs the `load` from A1; fresh `data` flows back in; the table reflects whatever the background processor changed. The `return () => clearInterval(id)` cleans up on unmount.

There are many more `$derived` views in this page (`failedCount`, `needsReviewCount`, `slopFailedByPipeline`, `inFlightByPipelinePhase`, the `deterministicPhases` set used to detect gate-blocked tasks) — all pure functions of `data`, all recomputed reactively. No data is duplicated into local state.

### A3. action — Approve, the round trip

The captain clicks **approve** on a `needs_review` row. Markup (`tasks/+page.svelte:395`):

```svelte
<button class="text-ok text-xs mr-2" onclick={() => approve(t.id)}>approve</button>
```

> Note: **no `confirm()` dialog.** Clicking the button *is* the confirmation — a deliberate project convention across all action buttons ([05](./05-components-and-patterns.md#no-confirm-dialogs)).

The handler (`tasks/+page.svelte:32-35`):

```ts
async function approve(id: string) {
  await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
  await invalidateAll();
}
```

That `fetch` hits `api/tasks/[id]/approve/+server.ts`, which calls **one** engine function and handles the gate-block conflict:

```ts
export async function POST({ params }) {
  try {
    const task = await approveTask(params.id);
    if (!task) throw error(404, "task not found or not in needs_review");
    return json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cannot approve past failed")) throw error(409, msg);
    throw err;
  }
}
```

`approveTask(id)` in `core/lib/processor.ts:381` does the real work — and refuses to bypass a failed **deterministic** gate:

```ts
export async function approveTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "needs_review") return null;
  const pipeline = getPipeline(task.pipelineId);
  if (!pipeline) return null;
  const phase = getPhase(pipeline, task.phaseId);
  if (!phase) return null;
  if (phase.gateType === "deterministic" && task.gateFailReason) {
    …
    throw new Error(`cannot approve past failed ${phase.id} gate — rerun the gate or reject the task`);
  }
  await advanceOrComplete(pipeline, phase, task);   // ← the advance
  return await getTask(id);
}
```

`advanceOrComplete()` (`core/lib/processor.ts:306`) is where the pipeline graph moves forward. Three outcomes:

1. **No next phase** → mark this task `completed`.
2. **Next phase, no fan-out** → create one child task at the next phase (`status: pending`, inheriting `input` + the just-finished phase's `output` + `previousTaskId`), then mark this task `completed`.
3. **Next phase with `fanOut`** → call `phase.fanOut(task)` to get N elements; create N children at the next phase. The first `fanOutBatchSize` go `pending`; the rest go **`paused_user`** so a single approval can't kick off hundreds of Claude calls at once (drained later via [`/api/tasks/resume`](./03-api-endpoints.md#post-apitasksresume)). Then mark this task `completed`.

   ```ts
   const batchSize = pipeline.fanOutBatchSize ?? elements.length;
   for (let i = 0; i < elements.length; i++) {
     const status = i < batchSize ? "pending" : "paused_user";
     await createTask({ pipelineId: pipeline.id, phaseId: next,
       input: { ...fanOutBase, ...elements[i] }, parentId: task.parentId ?? task.id, status });
   }
   await updateTask(task.id, { status: "completed" });
   ```

All of that writes `task.json` files. The endpoint returns `json({ task })`. Back in the browser, `approve()`'s `await invalidateAll()` **re-runs the A1 load**, which re-reads disk — the approved task now shows `completed`, and any new child task appears as `pending`. The 3-second poll would have caught it anyway; the explicit `invalidateAll()` just makes it instant.

### A4. The numbered sequence

```
 1. browser GET /tasks
 2.   tasks/+page.server.ts load()  →  listTasks() + pipelineStatus()
                                       + readLastProcessorState() + extractFailures()
 3.   returns { tasks, pipelines, lastProcessor, failures }
 4.   tasks/+page.svelte renders  (data via $props, visibleTasks via $derived)
 5.   $effect starts setInterval(invalidateAll, 3000)
 6. captain clicks "approve" on task T   (no confirm dialog)
 7.   approve(T.id):  fetch POST /api/tasks/{T.id}/approve
 8.     api/tasks/[id]/approve/+server.ts → approveTask(T.id)
 9.       processor.ts: gate-check → advanceOrComplete(pipeline, phase, T)
10.         creates next task / fans out (pending + paused_user) / completes T
11.         → writes task.json files
12.     endpoint returns json({ task })
13.   approve():  await invalidateAll()  → re-runs load() (step 2)
14.   fresh data flows back → T shows "completed", child shows "pending"
```

> Steps 8–11 are **pure engine** — no SvelteKit concepts. The dashboard's whole job is steps 1–7 and 12–14: read, render, POST, re-read.

### A5. Detail-page variant

`/tasks/[id]` uses the same shape with one difference: its action handlers call `location.reload()` instead of `invalidateAll()` (`tasks/[id]/+page.svelte:77-92`), because a full reload re-runs `tasks/[id]/+page.server.ts` (which additionally reads phase `output.md`/`meta.json` off disk). Same engine functions (`approveTask`, `rejectTask`, `rerunTask`, `deleteTask`), same "POST then re-read" pattern.

---

## Part B — The heartbeat (OS cron → one tick)

Nothing in Part A *executes* a `pending` task — approval only *advances the graph*. Execution happens only when the processor runs. That's the heartbeat:

```
OS cron (e.g. every minute)
   └─ curl/POST  http://localhost:3001/api/cron
         └─ api/cron/+server.ts
               └─ runProcessor()            ← core/lib/processor.ts, ONE tick
                     ├─ pick eligible pending tasks (per-tick cap, backpressure,
                     │    pipeline-enabled, paused/disabled all respected)
                     ├─ run each task's phase.run()  (may call claude, write files)
                     ├─ on success: gate-check →
                     │     auto_pass / deterministic-pass → advanceOrComplete()
                     │     needs_review                   → status = needs_review
                     │     deterministic-fail (budget left)→ retry; (exhausted) → needs_review + gateFailReason
                     ├─ on throw: retry up to budget, else status = failed
                     └─ persist last-tick summary (processed / deferred / lastRunAt)
               └─ returns the ProcessorResult as JSON
```

`api/cron/+server.ts` is the whole web surface of the heartbeat:

```ts
export async function POST() {
  const result = await runProcessor();
  return json(result);
}
```

The same endpoint is also wired to a button — `tasks/+page.svelte:88-91` `runCron()` POSTs `/api/cron` then `invalidateAll()`, so you can hand-pump a tick from the UI. And the vault-staging "Embed approved" flow approves a task **and then** POSTs `/api/cron` to immediately run the embed phase (`vault/staging/[task]/+page.svelte:57-60`).

After a tick, the Tasks page's `data.lastProcessor` surfaces a banner when work was deferred (`tasks/+page.svelte:212-220`):

```svelte
{#if data.lastProcessor && data.lastProcessor.deferred > 0}
  <div class="bg-warn/10 border border-warn/40 rounded p-3 text-sm">
    <strong class="text-warn">{data.lastProcessor.deferred} task(s) deferred to next tick</strong>
    <span class="text-muted ml-2">last /api/cron ran {…} · processed {data.lastProcessor.processed}</span>
  </div>
{/if}
```

> **Why split approval (A) from execution (B)?** Approval is a human, on-demand graph move; execution is a metered background loop with caps, retries, and backpressure. Keeping them separate is what lets the dashboard be stateless and the engine be the single executor. The dashboard *triggers* and *observes*; it never runs phase logic itself.

---

## Part C — The architectural invariant

```
   ┌────────────── DASHBOARD (stateless) ──────────────┐      ┌──── ENGINE (stateful) ────┐
   │  +page.server.ts load()   ─── reads ──────────────┼─────►│ core/lib/* · pipelines/*  │
   │  /api/* +server.ts POST   ─── one fn call ────────┼─────►│   (the only writer)        │
   │  invalidateAll()/reload() ─── re-read ────────────┼─────►│ task.json, vault/, signals/│
   └───────────────────────────────────────────────────┘      └────────────────────────────┘
```

- **Every load reads core.** No page caches engine state across requests.
- **Every button POSTs an endpoint that calls core.** No mutation happens in the browser (except the optimistic vault-staging UI, which still POSTs the real decision — [05](./05-components-and-patterns.md#optimistic-local-mutation)).
- **The engine is the only writer.** `task.json` files are the source of truth; the dashboard is a window onto them plus a remote control.

---

### Cross-links

- [`../core/03-processor.md`](../core/03-processor.md) — `runProcessor`, `approveTask`, `advanceOrComplete`, fan-out, gates, retries (heavily relevant here).
- [`../core/05-task-store.md`](../core/05-task-store.md) — `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask` (the disk layer).
- [03 — API endpoints](./03-api-endpoints.md) — every endpoint touched above.
- [02 — Routing & loads](./02-routing-and-loads.md) — the load/poll pattern in general.
- [05 — Components & patterns](./05-components-and-patterns.md) — the buttons, the no-confirm convention, the Failures panel.
