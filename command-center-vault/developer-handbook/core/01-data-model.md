# Core 01 — The Data Model (`core/lib/types.ts`)

This is the single source of truth for every shape the runtime touches. Every other core module — the [processor](03-processor.md), the [task store](05-task-store.md), the [gates](04-gates.md), the [registry](07-registry-bootstrap.md) — imports its types from here. If you understand this file, you understand the vocabulary of the entire system.

`types.ts` is **pure types plus four constants**. It has no runtime behavior, no imports, no side effects. It compiles to (almost) nothing. That is deliberate: the data model is domain-agnostic and dependency-free so that pipelines can plug in without dragging core into their concerns.

> See [`../primers/typescript-node-primer.md`](../primers/typescript-node-primer.md) for how TypeScript `interface` / `type` declarations work and how they erase at compile time.

The whole file is short enough to keep in your head. Below, every declaration is reproduced verbatim and then explained.

---

## `GateType`

```ts
// core/lib/types.ts:1
export type GateType = "needs_review" | "deterministic" | "auto_pass";
```

A string-literal union with exactly three members. A phase's `gateType` decides what happens *after* the phase's `run()` produces output:

- `"needs_review"` — park the task for the human ("captain") to approve/reject. Nothing advances automatically.
- `"deterministic"` — run the phase's `check()` function. Pass → advance. Fail → retry/rewind/exhaust (see [04-gates.md](04-gates.md)).
- `"auto_pass"` — advance immediately, no human, no check.

These three strings are matched literally inside `applyGate()` in the processor. There is no default and no fourth value; an unknown string would simply match none of the branches.

---

## `TaskStatus`

```ts
// core/lib/types.ts:3-11
export type TaskStatus =
  | "pending"
  | "running"
  | "needs_review"
  | "completed"
  | "failed"
  | "paused_backpressure"
  | "paused_user"
  | "cleared_stale";
```

Eight states. This is the spine of the whole runtime — the [task lifecycle](02-task-lifecycle.md) is a state machine over exactly these values. Memorize them:

| Status | Meaning | Who/what sets it |
| --- | --- | --- |
| `pending` | Queued, waiting for a processor tick to dispatch it. | `createTask` default; rewind/retry; resume actions |
| `running` | A processor tick is currently executing the phase's `run()`. | `runPhase` (processor) |
| `needs_review` | Parked for the captain — either a `needs_review` gate, or a `deterministic` gate that exhausted its retries. | `applyGate` |
| `completed` | Reached the end of the pipeline (or fanned out / fan-out was empty). Terminal. | `advanceOrComplete` |
| `failed` | An error was thrown (non-rate-limit) or the captain rejected it. Terminal until `rerunTask`. | `fail`, `rejectTask` |
| `paused_backpressure` | First-phase task held back because too many `needs_review` tasks already exist in this pipeline. | `runProcessor` dispatch loop |
| `paused_user` | Manually disabled by the captain, OR a fan-out child held back beyond `fanOutBatchSize`. | `disableTask`, fan-out batching |
| `cleared_stale` | A maintenance/cleanup status. **Defined and weighted, but never assigned anywhere in `core/lib/`.** | (external/manual only) |

> **Goodbye note — `cleared_stale`:** Grep core for it and you will find it in exactly two places: the union above, and the sort-weight map in [`tasks.ts:60`](05-task-store.md). Nothing in `core/lib/` ever writes a task to `cleared_stale`. It exists so that if you (or a script outside core) set a task to that status, the list view sorts it last and the type-checker accepts it. Do not expect the processor to produce it.

---

## `GateCheckResult`

```ts
// core/lib/types.ts:13-16
export interface GateCheckResult {
  pass: boolean;
  reason?: string;
}
```

What a deterministic gate's `check()` returns. `pass: false` with a `reason` is the interesting case: that `reason` string flows back upstream as `gateRetryFeedback` (see [04-gates.md](04-gates.md)) and is also stored on the task as `gateFailReason` when retries exhaust. The [slop engine](08-slop-engine.md)'s `SlopResult` is *not* the same type — pipelines convert a slop result into a `GateCheckResult` inside their `check()`.

---

## `RetryPolicy`

```ts
// core/lib/types.ts:18-20
export interface RetryPolicy {
  maxAttempts: number;
}
```

Currently one field. Attached to a `PhaseConfig` and consumed only by the deterministic-gate retry logic, which reads `phase.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_MAX`. If `retryPolicy` is omitted, the budget is `DEFAULT_RETRY_MAX` (3).

---

## `PhaseConfig` — the heart of a pipeline

```ts
// core/lib/types.ts:22-45
export interface PhaseConfig {
  id: string;
  slashCommand?: string;
  gateType: GateType;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  check?: (task: Task) => Promise<GateCheckResult>;
  run?: (task: Task, ctx: PhaseContext) => Promise<PhaseOutput>;
  /**
   * Optional fan-out: when defined, on advance the processor creates one
   * downstream task per element returned. Each element becomes the `input`
   * of a new next-phase task (merged with this task's input + previousTaskId).
   * Falls back to single-task advance when undefined.
   */
  fanOut?: (task: Task) => Promise<Array<Record<string, unknown>>>;
  /**
   * Optional hook fired when a deterministic gate exhausts its retry budget,
   * just before the task transitions to needs_review. Lets the pipeline clean
   * up artifacts (e.g. delete failing draft files) so they can't be mistaken
   * for usable output. Errors are caught and logged — the transition still
   * happens regardless.
   */
  onExhausted?: (task: Task, reason: string) => Promise<void>;
}
```

A pipeline is an ordered array of these. Field by field:

| Field | Required | Consumed where | Notes |
| --- | --- | --- | --- |
| `id` | yes | everywhere (phase lookup, dirs) | Must be unique within the pipeline; used as the on-disk phase directory name. |
| `slashCommand` | no | **NOT read in core** | See below. |
| `gateType` | yes | `applyGate` | One of the three `GateType` values. |
| `timeoutMs` | no | **NOT read in core** | See below. |
| `retryPolicy` | no | `applyGate` (deterministic branch) | `maxAttempts` for the gate budget. |
| `check` | no* | `applyGate` (deterministic branch) | *Required if `gateType === "deterministic"` — absence is a hard fail. |
| `run` | no | `runPhase` | The actual work. If omitted, the phase produces no output and goes straight to its gate. |
| `fanOut` | no | `advanceOrComplete` | One downstream task per returned element. See [03-processor.md](03-processor.md). |
| `onExhausted` | no | `applyGate` (exhaustion branch) | Cleanup hook; its throw is swallowed. |

### Fields declared but NOT read in core

These are part of the contract and several pipelines set them, but **the core runtime never reads them**. Knowing this saves you debugging time when changing one has no effect:

- **`PhaseConfig.slashCommand`** — never referenced in `core/lib/`. The actual Claude slash invocation happens inside a phase's own `run()` by calling [`claudeSlash(...)`](06-claude-wrapper.md) directly with whatever command string it wants. `slashCommand` is documentation/convention; the processor does nothing with it.
- **`PhaseConfig.timeoutMs`** — never referenced in `core/lib/`. The processor does not impose a per-phase timeout. The *only* timeout that exists is the Claude CLI subprocess timeout inside [`claude.ts`](06-claude-wrapper.md) (`DEFAULT_TIMEOUT_MS`, 120 s), which a phase opts into by passing `timeoutMs` to `claude()`/`claudeSlash()`. Setting `PhaseConfig.timeoutMs` alone does nothing.

> **Goodbye note:** If you want a phase to honor `PhaseConfig.timeoutMs`, you must wire it yourself — either pass it through to `claude()` from inside `run()`, or wrap `phase.run(...)` in `runPhase` with `Promise.race` against a timer. Today neither exists.

---

## `PhaseOutput`

```ts
// core/lib/types.ts:47-50
export interface PhaseOutput {
  output?: Record<string, unknown>;
  outputFiles?: Record<string, string>;
}
```

What a phase's `run()` returns. Only `output` matters to core:

```ts
// core/lib/processor.ts:186-191
output = result.output;
if (output) {
  await writePhaseOutput(task.id, phase.id, JSON.stringify(output, null, 2), output);
}
}
await updateTask(task.id, { output });
```

`output` is serialized to the phase's `output.md` + `meta.json` (see [05-task-store.md](05-task-store.md)) and stored on the task as `task.output`. It then becomes part of the next task's `input` on a single advance (`{ ...task.input, ...output, previousTaskId }`).

- **`PhaseOutput.outputFiles`** — **NOT read in core.** `runPhase` only ever destructures `result.output`. If a phase wants to write files, it does so directly using the `outputDir` from its `PhaseContext`. `outputFiles` is an unused convention slot.

---

## `PhaseContext` — what `run()` receives

```ts
// core/lib/types.ts:52-57
export interface PhaseContext {
  taskDir: string;
  inputDir: string;
  outputDir: string;
  log: (msg: string, data?: unknown) => void;
}
```

Constructed fresh by `runPhase` for each phase execution:

```ts
// core/lib/processor.ts:180-185
const result = await phase.run(task, {
  taskDir: taskDir(task.id),
  inputDir: prevPhaseDir(pipeline, phase, task),
  outputDir: dir,
  log: (msg, data) => consoleLog("phase_log", { taskId: task.id, phaseId: phase.id, msg, data }),
});
```

- `taskDir` — `tasks/<id>/` (the task root).
- `inputDir` — the **previous phase's** output directory (`tasks/<id>/<prevPhaseId>/`). For the first phase, `prevPhaseDir` returns `taskDir` itself (there is no previous phase). This is how a phase reads what the prior phase wrote to disk.
- `outputDir` — this phase's own directory (`tasks/<id>/<phaseId>/`), already `mkdir`'d before `run()` is called.
- `log` — a convenience logger that funnels into `consoleLog("phase_log", ...)`. See [10-utilities.md](10-utilities.md) for `consoleLog`.

---

## `PipelineConfig` — a whole pipeline

```ts
// core/lib/types.ts:59-81
export interface PipelineConfig {
  id: string;
  description?: string;
  phases: PhaseConfig[];
  backpressureCap?: number;
  /**
   * Maximum number of pending tasks for this pipeline to dispatch in one
   * processor tick. When set, this pipeline has its own independent budget.
   * When unset, the pipeline shares the global `PROCESSOR_PER_TICK_CAP` pool
   * with every other pipeline that also has no override.
   */
  perTickCap?: number;
  /**
   * Maximum number of fan-out children to create with `status: pending` at
   * once. Children beyond this count are created as `paused_user` and stay
   * inert until the captain clicks "Resume next batch" on /tasks or the
   * pipeline's dashboard page. This prevents a single approval (e.g. brand
   * discovery picking 204 candidates) from kicking off hundreds of claude
   * calls all at once. Unset = no batch limit (legacy behavior).
   */
  fanOutBatchSize?: number;
  cronSchedule?: string;
}
```

| Field | Required | Consumed where | Default behavior if unset |
| --- | --- | --- | --- |
| `id` | yes | registry key, task `pipelineId` | — |
| `description` | no | UI only (not core logic) | — |
| `phases` | yes | everything | `registerPipeline` throws if `phases.length === 0` |
| `backpressureCap` | no | `isCapped` | `DEFAULT_BACKPRESSURE_CAP` (5) |
| `perTickCap` | no | dispatch loop | shares the global `PROCESSOR_PER_TICK_CAP` pool |
| `fanOutBatchSize` | no | `advanceOrComplete` fan-out | no limit — all children go `pending` |
| `cronSchedule` | no | **NOT read in core** | see below |

### `cronSchedule` — declared but NOT read in core

Grep `core/lib/` and `cronSchedule` appears only in this interface. The core runtime has no scheduler — `runProcessor()` runs one tick when something calls it. Whatever drives the ticks (a cron job, the dashboard, a manual script) lives outside core, and *that* is where a cron schedule would be honored if at all. Setting `cronSchedule` on a `PipelineConfig` has zero effect on the runtime by itself.

> See [`../dashboard/03-api-endpoints.md`](../dashboard/03-api-endpoints.md) for how ticks are actually triggered, and [`../pipelines/00-index.md`](../pipelines/00-index.md) for which pipelines declare a `cronSchedule`.

---

## `TaskAttempt` — the audit trail

```ts
// core/lib/types.ts:83-89
export interface TaskAttempt {
  phaseId: string;
  startedAt: string;
  finishedAt?: string;
  outcome: "ok" | "gate_fail" | "error";
  reason?: string;
}
```

Every phase execution appends one of these to `task.attempts`. The three `outcome` values:

- `"ok"` — the phase ran and its gate passed (or it parked at `needs_review`).
- `"gate_fail"` — a deterministic gate's `check()` returned `pass: false`. The `reason` is the gate's reason.
- `"error"` — `run()` (or the gate) threw. The `reason` is the error message.

`clearFailureAttempts` (in [05-task-store.md](05-task-store.md)) deletes every `gate_fail` and `error` entry, keeping only `ok` — that is what the "clear failures" button and the rerun actions call so the Failures panel stops showing already-handled noise.

---

## `Task` — the on-disk record

```ts
// core/lib/types.ts:91-105
export interface Task {
  id: string;
  pipelineId: string;
  phaseId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  attempts: TaskAttempt[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  parentId?: string;
  error?: string;
  retryCount?: number;
  gateFailReason?: string;
}
```

This is what lives in `tasks/<id>/task.json`. Every field:

| Field | Type | Set at create | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | `generateId()` (12 hex chars) | Unique; also the directory name. |
| `pipelineId` | `string` | from `CreateTaskInput` | Which pipeline this task belongs to. |
| `phaseId` | `string` | from `CreateTaskInput` | Which phase the task is *currently at*. Mutated on advance/rewind. |
| `status` | `TaskStatus` | `"pending"` (or override) | The state-machine position. |
| `createdAt` | ISO string | `nowIso()` | FIFO ordering key; never changes. |
| `updatedAt` | ISO string | `nowIso()` | Bumped on every `updateTask`/`appendAttempt`/`clearFailureAttempts`. |
| `attempts` | `TaskAttempt[]` | `[]` | Audit log, appended over time. |
| `input` | `Record<string, unknown>` | from `CreateTaskInput` | The task's payload. **Also where the gate retry budget lives** — `input.gateRetryCount` and `input.gateRetryFeedback`. See [04-gates.md](04-gates.md). |
| `output` | `Record<string, unknown>?` | absent | Set by `runPhase` from the phase's `PhaseOutput.output`. |
| `parentId` | `string?` | from `CreateTaskInput` | Set on advance/fan-out children (`task.parentId ?? task.id`) to chain lineage. |
| `error` | `string?` | absent | The failure message (set by `fail`/`rejectTask`; cleared to `""` on rerun). |
| `retryCount` | `number?` | `0` | The *in-place* retry counter (legacy first-phase-gate path) — **not** the rewind budget. |
| `gateFailReason` | `string?` | absent | Set when a deterministic gate exhausts retries; its presence is what `approveTask` checks to *block* approval past a failed hard gate. |

> **Goodbye note — two different retry counters.** `task.retryCount` and `task.input.gateRetryCount` are *not* the same thing and serve different paths. `retryCount` is the legacy in-place retry used only when a deterministic gate has *no previous phase* to rewind to. `input.gateRetryCount` is the real budget for the rewind loop, and it lives in `input` precisely because the rewind creates round-trips through other phases where a top-level `retryCount` would not survive. [04-gates.md](04-gates.md) explains why in detail — read it before touching retry logic.

---

## Constants

```ts
// core/lib/types.ts:107-110
export const DEFAULT_BACKPRESSURE_CAP = 5;
export const DEFAULT_RETRY_MAX = 3;
export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_PROCESSOR_PER_TICK_CAP = 10;
```

| Constant | Value | Used where | Overridable by |
| --- | --- | --- | --- |
| `DEFAULT_BACKPRESSURE_CAP` | `5` | `isCapped` in processor | `PipelineConfig.backpressureCap` |
| `DEFAULT_RETRY_MAX` | `3` | deterministic gate budget | `PhaseConfig.retryPolicy.maxAttempts` |
| `DEFAULT_TIMEOUT_MS` | `120_000` (120 s) | **Note:** *re-declared* in `claude.ts`, see below | `claude()` `timeoutMs` option |
| `DEFAULT_PROCESSOR_PER_TICK_CAP` | `10` | global dispatch budget | `PROCESSOR_PER_TICK_CAP` env var, or `PipelineConfig.perTickCap` |

> **Subtle duplication worth knowing:** [`claude.ts`](06-claude-wrapper.md) defines its *own* local `const DEFAULT_TIMEOUT_MS = 120_000;` (`core/lib/claude.ts:3`) and does **not** import the one from `types.ts`. They happen to be equal, but they are independent. If you change one, change both (or unify them) — otherwise the Claude subprocess timeout and any code reading `types.DEFAULT_TIMEOUT_MS` will silently diverge. As of this writing, nothing in core actually reads `types.DEFAULT_TIMEOUT_MS` — it is exported for completeness/pipelines.

`100_000`-style numeric separators are a TypeScript/JS feature (underscores in numeric literals); see the [TypeScript docs](https://www.typescriptlang.org/docs/). They are purely cosmetic.

---

## Where to go next

- [02-task-lifecycle.md](02-task-lifecycle.md) — the state machine over `TaskStatus`.
- [03-processor.md](03-processor.md) — who reads each field, one tick at a time.
- [04-gates.md](04-gates.md) — `gateType` branching and the retry-budget design.
- [05-task-store.md](05-task-store.md) — how `Task` is persisted, locked, and cached.
