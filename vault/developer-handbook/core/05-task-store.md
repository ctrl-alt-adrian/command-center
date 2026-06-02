# Core 05 — The Task Store (`core/lib/tasks.ts`)

Tasks live on disk as JSON files. `tasks.ts` is the only module that reads and writes them, and it enforces two disciplines you must never break: **every mutation goes through `withFileLock`** (so concurrent ticks/requests don't clobber each other), and **every mutation busts the list cache** (so the next `listTasks()` sees fresh data). This page covers the layout, every function, and why the locking/cache rules exist.

> Prereqs: [01-data-model.md](01-data-model.md) (`Task`, `TaskAttempt`). Locking and caching primitives are in [10-utilities.md](10-utilities.md).

---

## On-disk layout

Paths come from [`paths.ts`](10-utilities.md):

```ts
// core/lib/paths.ts:3-25
export const COMMAND_CENTER_ROOT =
  process.env.COMMAND_CENTER_ROOT ?? path.resolve(import.meta.dirname ?? __dirname, "..", "..");

export const TASKS_DIR = path.join(COMMAND_CENTER_ROOT, "tasks");
...
export function taskDir(id: string): string { return path.join(TASKS_DIR, id); }
export function taskFile(id: string): string { return path.join(taskDir(id), "task.json"); }
export function phaseDir(taskId: string, phaseId: string): string {
  return path.join(taskDir(taskId), phaseId);
}
```

So the tree is:

```
<COMMAND_CENTER_ROOT>/
└── tasks/
    └── <id>/                     # taskDir(id)
        ├── task.json             # taskFile(id) — the Task record
        ├── <phaseId>/            # phaseDir(id, phaseId) — one per phase that ran
        │   ├── output.md         # JSON-stringified PhaseOutput.output
        │   └── meta.json         # the same output object as JSON
        └── ...
```

`COMMAND_CENTER_ROOT` defaults to two directories up from `core/lib/` (i.e. the repo root), overridable by the `COMMAND_CENTER_ROOT` env var. The `<id>` is a 12-hex-char string from [`generateId()`](10-utilities.md).

---

## `CreateTaskInput` and `createTask`

```ts
// core/lib/tasks.ts:10-36
export interface CreateTaskInput {
  pipelineId: string;
  phaseId: string;
  input?: Record<string, unknown>;
  parentId?: string;
  status?: TaskStatus;
}

export async function createTask(opts: CreateTaskInput): Promise<Task> {
  const id = generateId();
  const task: Task = {
    id,
    pipelineId: opts.pipelineId,
    phaseId: opts.phaseId,
    status: opts.status ?? "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: [],
    input: opts.input ?? {},
    parentId: opts.parentId,
    retryCount: 0,
  };
  await fs.mkdir(taskDir(id), { recursive: true });
  await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
  tasksCache.bust();
  return task;
}
```

Note: `createTask` does **not** take a lock — the file doesn't exist yet, so there's no contention (the random id guarantees uniqueness). It does bust the cache. `status` defaults to `pending`; the processor passes `paused_user` for batch-held fan-out children.

---

## `getTask` — uncached single read

```ts
// core/lib/tasks.ts:38-40
export async function getTask(id: string): Promise<Task | null> {
  return readJsonOrNull<Task>(taskFile(id));
}
```

Always reads from disk (no cache). Returns `null` if the file is missing or unparseable. The processor uses `getTask` deliberately when it needs the *freshest* record (e.g. re-reading `input.gateRetryCount` inside `applyGate`, or `fresh` before advance) — the 2-second list cache would be too stale for those.

---

## `listTasks` (cached) and `listTasksUncached` (the sort)

```ts
// core/lib/tasks.ts:42-78
async function listTasksUncached(): Promise<Task[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(TASKS_DIR);
  } catch {
    return [];
  }
  const loaded = await Promise.all(entries.map((e) => getTask(e)));
  const tasks = loaded.filter((t): t is Task => t !== null);
  // Sort: running, pending, needs_review, paused (both kinds), failed, completed, cleared_stale
  const weight: Record<TaskStatus, number> = {
    running: 0,
    pending: 1,
    paused_user: 2,
    paused_backpressure: 3,
    needs_review: 4,
    failed: 5,
    completed: 6,
    cleared_stale: 7,
  };
  tasks.sort((a, b) => {
    const sw = weight[a.status] - weight[b.status];
    if (sw !== 0) return sw;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return tasks;
}

const tasksCache = ttlCache(listTasksUncached, 2000);

export function bustTasksCache(): void {
  tasksCache.bust();
}

export async function listTasks(): Promise<Task[]> {
  return tasksCache.get();
}
```

`listTasksUncached` reads every `tasks/<id>/task.json`, drops nulls, and sorts by **status weight first, then `createdAt` descending** (newest first within a status). The weight map:

| Weight | Status |
| --- | --- |
| 0 | `running` |
| 1 | `pending` |
| 2 | `paused_user` |
| 3 | `paused_backpressure` |
| 4 | `needs_review` |
| 5 | `failed` |
| 6 | `completed` |
| 7 | `cleared_stale` |

So the list view surfaces active work at the top and terminal/stale work at the bottom. **Important:** this sort is for *display*. The processor does its own FIFO sort by `createdAt` ascending on the pending subset (see [03-processor.md](03-processor.md)) — it does not rely on this list order for dispatch ordering.

`listTasks()` wraps the uncached version in a **2-second TTL cache** (`ttlCache(..., 2000)`, see [10-utilities.md](10-utilities.md)). The cache is single-flight (concurrent callers share one in-flight scan) and must be busted on every write. `bustTasksCache()` is exported so external callers (e.g. dashboard endpoints that write task files directly) can invalidate too.

---

## `listTasksByPipeline`

```ts
// core/lib/tasks.ts:80-83
export async function listTasksByPipeline(pipelineId: string): Promise<Task[]> {
  const all = await listTasks();
  return all.filter((t) => t.pipelineId === pipelineId);
}
```

Filters the cached list. Used by `isCapped` and `pipelineStatus`.

---

## `updateTask` — the locked mutator

```ts
// core/lib/tasks.ts:85-97
export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "status" | "phaseId" | "output" | "error" | "retryCount" | "gateFailReason" | "input">>,
): Promise<Task | null> {
  return withFileLock(taskFile(id), async () => {
    const task = await getTask(id);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: nowIso() });
    await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
    tasksCache.bust();
    return task;
  });
}
```

This is **the** mutation primitive. Key properties:

1. **Locked.** `withFileLock(taskFile(id), ...)` ensures no other tick/request writes the same `task.json` concurrently (see [10-utilities.md](10-utilities.md) / [lock.ts]).
2. **Re-read under the lock.** It calls `getTask(id)` *inside* the lock, not before — so it always merges into the freshest record. This is why two near-simultaneous `updateTask` calls don't lose each other's changes.
3. **Whitelisted fields.** The `Partial<Pick<...>>` type restricts what you can update: `status`, `phaseId`, `output`, `error`, `retryCount`, `gateFailReason`, `input`. You **cannot** mutate `id`, `pipelineId`, `createdAt`, `attempts`, or `parentId` through `updateTask`. (`attempts` is mutated only by `appendAttempt`/`clearFailureAttempts`.)
4. **Bumps `updatedAt`** and **busts the cache** on every write.

> **Goodbye note — the locking+cache discipline.** The correctness of the whole runtime rests on the read-modify-write being atomic per task file. If you add a new mutation path, it MUST follow this exact shape: take the lock on `taskFile(id)`, re-read with `getTask` *inside* the lock, write, bust the cache. Skipping the re-read or the lock will cause lost updates under concurrency (the processor runs phases in parallel via `Promise.all`). Skipping the cache bust will make `listTasks()` serve stale data for up to 2 seconds — which can cause the processor to re-dispatch a task it already moved.

---

## `appendAttempt`

```ts
// core/lib/tasks.ts:99-108
export async function appendAttempt(id: string, attempt: TaskAttempt): Promise<void> {
  await withFileLock(taskFile(id), async () => {
    const task = await getTask(id);
    if (!task) return;
    task.attempts.push(attempt);
    task.updatedAt = nowIso();
    await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
    tasksCache.bust();
  });
}
```

Same locked/re-read/bust pattern, dedicated to pushing onto `attempts`. Separate from `updateTask` because `attempts` isn't in the update whitelist (appending must read-then-push, never overwrite).

---

## `deleteTask`

```ts
// core/lib/tasks.ts:110-113
export async function deleteTask(id: string): Promise<void> {
  await fs.rm(taskDir(id), { recursive: true, force: true });
  tasksCache.bust();
}
```

Removes the entire task directory (task.json + all phase dirs). No lock — a delete is destructive and total. Busts the cache. Note: nothing in core *calls* `deleteTask`; it exists for external cleanup (dashboard / scripts).

---

## `clearFailureAttempts`

```ts
// core/lib/tasks.ts:119-133
export async function clearFailureAttempts(id: string): Promise<number> {
  return withFileLock(taskFile(id), async () => {
    const task = await getTask(id);
    if (!task) return 0;
    const before = task.attempts.length;
    task.attempts = task.attempts.filter((a) => a.outcome !== "error" && a.outcome !== "gate_fail");
    const removed = before - task.attempts.length;
    if (removed > 0) {
      task.updatedAt = nowIso();
      await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
      tasksCache.bust();
    }
    return removed;
  });
}
```

Removes every `error` and `gate_fail` attempt, keeping `ok`. Returns the count removed. Only writes (and busts) if something was actually removed. Called by `rerunTask`, `rerunGate`, the gate rewind path, and the bulk "clear failures" button — anywhere the system wants the Failures panel to forget already-handled noise while preserving the success audit trail.

---

## `writePhaseOutput` / `readPhaseOutput`

```ts
// core/lib/tasks.ts:135-155
export async function writePhaseOutput(
  taskId: string, phaseId: string, content: string, meta?: Record<string, unknown>,
): Promise<void> {
  const dir = phaseDir(taskId, phaseId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "output.md"), content, "utf-8");
  if (meta) {
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  }
}

export async function readPhaseOutput(taskId: string, phaseId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(phaseDir(taskId, phaseId), "output.md"), "utf-8");
  } catch {
    return null;
  }
}
```

`writePhaseOutput` writes the phase's output to `output.md` (string content) and optionally `meta.json` (the structured object). The processor calls it as `writePhaseOutput(task.id, phase.id, JSON.stringify(output, null, 2), output)` — so for normal phases `output.md` is the pretty-printed JSON and `meta.json` is the same object. A phase's own `run()` can call `writePhaseOutput` with a *different* `content` (e.g. human-readable markdown) and a structured `meta` if it wants the two to differ. No lock here — phase dirs are per-(task, phase) and not contended within a single phase run.

`readPhaseOutput` returns the `output.md` string or `null` if absent.

---

## The two cache exports and when to bust manually

- `bustTasksCache()` — for code *outside* `tasks.ts` that writes a `task.json` directly (or deletes one) and needs `listTasks()` to reflect it immediately.
- The internal `tasksCache.bust()` calls inside every mutator handle the in-module paths.

If you find yourself writing a `task.json` from a dashboard endpoint without going through `updateTask`, you must call `bustTasksCache()` afterward — or, better, route through `updateTask`/`appendAttempt` so the lock protects you too.

---

## Where to go next

- [10-utilities.md](10-utilities.md) — `withFileLock` (lock.ts), `ttlCache` (cache.ts), `readJsonOrNull` (io.ts), `paths.ts` helpers.
- [03-processor.md](03-processor.md) — every caller of these functions.
- [01-data-model.md](01-data-model.md) — the `Task`/`TaskAttempt` shapes persisted here.
