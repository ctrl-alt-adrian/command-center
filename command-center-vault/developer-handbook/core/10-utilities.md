# Core 10 — Utilities (`paths`, `io`, `cache`, `lock`, `log`, `pipelineState`, `utils`)

The small modules that everything else stands on. None is more than ~40 lines, but together they define the filesystem layout, the JSON read/write conventions, the caching, the locking, the event log, the pipeline kill-switch, and the id/time helpers. This page documents each in full.

> These are referenced throughout: [05-task-store.md](05-task-store.md) (lock + cache), [03-processor.md](03-processor.md) (paths + log + pipelineState), [09-vault-reader.md](09-vault-reader.md) (cache + paths).

---

## `paths.ts` — roots and path helpers

```ts
// core/lib/paths.ts:1-25
import path from "path";

export const COMMAND_CENTER_ROOT =
  process.env.COMMAND_CENTER_ROOT ?? path.resolve(import.meta.dirname ?? __dirname, "..", "..");

export const TASKS_DIR = path.join(COMMAND_CENTER_ROOT, "tasks");
export const SIGNALS_DIR = path.join(COMMAND_CENTER_ROOT, "signals");
export const DRAFTS_DIR = path.join(COMMAND_CENTER_ROOT, "drafts");
export const VAULT_ROOT = process.env.VAULT_ROOT ?? path.join(COMMAND_CENTER_ROOT, "vault");
export const LEGACY_SESSIONS_ROOT =
  process.env.LEGACY_SESSIONS_ROOT ?? path.join(process.env.HOME ?? "", "Documents", "rolenext", "sessions");
export const LOGS_DIR = path.join(COMMAND_CENTER_ROOT, "logs");
export const PROCESSOR_STATE_FILE = path.join(LOGS_DIR, "processor-state.json");

export function taskDir(id: string): string { return path.join(TASKS_DIR, id); }
export function taskFile(id: string): string { return path.join(taskDir(id), "task.json"); }
export function phaseDir(taskId: string, phaseId: string): string {
  return path.join(taskDir(taskId), phaseId);
}
```

The single source of truth for where things live. Roots and their overrides:

| Constant | Default | Env override |
| --- | --- | --- |
| `COMMAND_CENTER_ROOT` | two dirs up from `core/lib/` (repo root) | `COMMAND_CENTER_ROOT` |
| `TASKS_DIR` | `<root>/tasks` | — |
| `SIGNALS_DIR` | `<root>/signals` | — |
| `DRAFTS_DIR` | `<root>/drafts` | — |
| `VAULT_ROOT` | `<root>/vault` | `VAULT_ROOT` |
| `LEGACY_SESSIONS_ROOT` | `$HOME/Documents/rolenext/sessions` | `LEGACY_SESSIONS_ROOT` |
| `LOGS_DIR` | `<root>/logs` | — |
| `PROCESSOR_STATE_FILE` | `<root>/logs/processor-state.json` | — |

Note `import.meta.dirname ?? __dirname` — works under both ESM (the `type: module` runtime) and any CJS fallback. The three path helpers (`taskDir`, `taskFile`, `phaseDir`) are the only sanctioned way to build task/phase paths; use them rather than hand-joining so the layout stays consistent. `SIGNALS_DIR`/`DRAFTS_DIR` are defined for pipelines that use them; core itself doesn't read them.

> **Goodbye note:** Changing `COMMAND_CENTER_ROOT` relocates **everything** — tasks, logs, vault (unless `VAULT_ROOT` is set independently). Set it via the repo-root `.env` (loaded by `hooks.server.ts`, see [07-registry-bootstrap.md](07-registry-bootstrap.md)) for a consistent runtime.

---

## `io.ts` — JSON read/write that swallows errors

```ts
// core/lib/io.ts:3-35
export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}
```

All read helpers **swallow every error** (missing file, parse failure, permission) and return a fallback:

- `readJson(path, fallback)` → `fallback` on any error.
- `readJsonOrNull(path)` → `null` on any error. (Used by `getTask`, `readState`, `readLastProcessorState`.)
- `writeJson(path, data)` → pretty 2-space JSON, utf-8. (Does *not* swallow — a write failure throws.)
- `safeReaddir(dir)` → `[]` on missing dir.

> **Design implication:** because reads return `null`/fallback silently, "task not found" and "task file is corrupt JSON" are indistinguishable at the call site — both look like `null`. Keep this in mind when debugging a task that "vanished": check whether its `task.json` is actually malformed.

---

## `cache.ts` — single-flight TTL memoizer

```ts
// core/lib/cache.ts:7-30
export interface TtlCache<T> {
  get(): Promise<T>;
  bust(): void;
}

export function ttlCache<T>(fn: () => Promise<T>, ttlMs: number): TtlCache<T> {
  let cached: { promise: Promise<T>; expiresAt: number } | null = null;

  return {
    get() {
      const now = Date.now();
      if (cached && cached.expiresAt > now) return cached.promise;
      const promise = fn().catch((err) => {
        if (cached?.promise === promise) cached = null;
        throw err;
      });
      cached = { promise, expiresAt: now + ttlMs };
      return promise;
    },
    bust() {
      cached = null;
    },
  };
}
```

A tiny memoizer for expensive read-only fs scans. Two properties make it correct:

1. **Single-flight.** It caches the **promise**, not the resolved value. Concurrent callers within the TTL all `await` the *same* in-flight `fn()` — so a burst of `listTasks()` calls triggers one disk scan, not N.
2. **Error self-eviction.** If `fn()` rejects, the cached entry is cleared (only if it's still the current one) and the error propagates — so a failed scan isn't cached as a poisoned promise; the next `get()` retries.

`bust()` clears the cache immediately. **Every write path must call `bust()`** or stale data is served until the TTL expires. Consumers and their TTLs:

| Cache | TTL | Bust on |
| --- | --- | --- |
| tasks list ([tasks.ts](05-task-store.md)) | 2000 ms | every task mutation |
| vault notes ([vault.ts](09-vault-reader.md)) | 5000 ms | `bustNotesCache()` after vault writes |

---

## `lock.ts` — advisory file lock (`O_EXCL` + stale-steal)

```ts
// core/lib/lock.ts:1-44
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 25;

export async function withFileLock<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      const fd = await fs.open(lockPath, "wx");
      await fd.close();
      try {
        return await fn();
      } finally {
        await fs.unlink(lockPath).catch(() => {});
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "EEXIST") throw err;
      // Lock exists. Check if it's stale.
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        // Lock just disappeared, loop and try again.
      }
      if (Date.now() > deadline) {
        throw new Error(`withFileLock timed out for ${targetPath}`);
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}
```

How it works:

- The lock is a sibling file `<targetPath>.lock`. Acquisition is `fs.open(lockPath, "wx")` — the `wx` flag is **exclusive create** (`O_CREAT | O_EXCL`): it succeeds only if the file doesn't exist, atomically. (See the Node [fs flags docs](https://nodejs.org/api/fs.html#file-system-flags).)
- On success: run `fn()`, then **always** `unlink` the lock in a `finally`.
- On `EEXIST` (someone holds it): `stat` the lock. If its mtime is older than `LOCK_TIMEOUT_MS` (5 s), assume the holder **crashed** and steal it (unlink + retry). Otherwise poll every `LOCK_RETRY_MS` (25 ms) until the **deadline** (5 s from start), then throw `withFileLock timed out`.
- Any non-`EEXIST` error is rethrown immediately.

This is what makes `updateTask`/`appendAttempt`/`clearFailureAttempts`/`setPipelineEnabled` safe under the processor's parallel `Promise.all`.

> **Goodbye note — it's advisory and best-effort.** This lock only protects code that *also* goes through `withFileLock` on the same `targetPath`. A direct `fs.writeFile` to a `task.json` bypasses it entirely. And the 5 s stale-steal means a legitimately slow operation holding the lock >5 s could have its lock stolen by another waiter — keep locked critical sections short (they are: read-modify-write of one small JSON file). It is also single-host (filesystem-local); it does not coordinate across machines.

---

## `log.ts` — JSONL event log + console

```ts
// core/lib/log.ts:6-16
export async function logEvent(kind: string, payload: Record<string, unknown>): Promise<void> {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  const day = nowIso().slice(0, 10);
  const line = JSON.stringify({ ts: nowIso(), kind, ...payload }) + "\n";
  await fs.appendFile(path.join(LOGS_DIR, `processor-${day}.log`), line, "utf-8");
}

export function consoleLog(kind: string, payload: Record<string, unknown>): void {
  console.log(`[${kind}]`, JSON.stringify(payload));
}
```

- `logEvent(kind, payload)` — appends one **JSON line** (`{ ts, kind, ...payload }\n`) to a **day-rotated** file `logs/processor-<YYYY-MM-DD>.log`. This is the durable, machine-readable processor audit log (JSONL — one JSON object per line).
- `consoleLog(kind, payload)` — synchronous, fire-and-forget to stdout as `[kind] {json}`. Used alongside `logEvent` for live visibility.

The processor calls both for almost every transition. The `kind` values you will see in the logs (all emitted from [processor.ts](03-processor.md), plus `phase_log` from the `PhaseContext.log` helper):

```
paused_backpressure   resumed              phase_start          phase_log
gate_needs_review     rate_limited_requeue gate_rewind          gate_retry
gate_exhausted        gate_exhausted_cleanup_failed             completed
fanout_empty          fanned_out           advanced             failed
approve_blocked_gate_failed                resumed_user         disabled
enabled               rerun_gate           rerun
```

> **Goodbye note:** these `kind` strings are your primary forensics tool. To trace one task's life: `grep '"taskId":"<id>"' logs/processor-*.log` and read the `kind`s in order. To find why a pipeline stalled, look for `paused_backpressure` without a matching `resumed`, or `gate_exhausted`.

---

## `pipelineState.ts` — the per-pipeline kill switch

```ts
// core/lib/pipelineState.ts:7-37
const PIPELINE_STATE_FILE = path.join(LOGS_DIR, "pipeline-state.json");

interface PipelineStateShape {
  [pipelineId: string]: { enabled: boolean };
}

async function readState(): Promise<PipelineStateShape> {
  return (await readJsonOrNull<PipelineStateShape>(PIPELINE_STATE_FILE)) ?? {};
}

export async function isPipelineEnabled(pipelineId: string): Promise<boolean> {
  const state = await readState();
  return state[pipelineId]?.enabled ?? true;
}

export async function getAllPipelineEnabledMap(): Promise<Record<string, boolean>> {
  const state = await readState();
  const out: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(state)) out[id] = v.enabled;
  return out;
}

export async function setPipelineEnabled(pipelineId: string, enabled: boolean): Promise<void> {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await withFileLock(PIPELINE_STATE_FILE, async () => {
    const state = await readState();
    state[pipelineId] = { enabled };
    await fs.writeFile(PIPELINE_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  });
}
```

Backs the per-pipeline on/off toggle on the dashboard. State lives in `logs/pipeline-state.json` as `{ "<pipelineId>": { "enabled": true|false } }`.

- **`isPipelineEnabled(id)` defaults to `true`** — a pipeline absent from the file is enabled. So the file only ever records *disabled* (or explicitly-re-enabled) pipelines. The [processor](03-processor.md) calls this in its dispatch loop; a disabled pipeline's pending tasks are deferred (stay `pending`).
- `getAllPipelineEnabledMap()` returns the raw map (used by `pipelineStatus`).
- `setPipelineEnabled(id, enabled)` is **file-locked** (read-modify-write under `withFileLock`) so concurrent toggles don't clobber. Note it does **not** go through a TTL cache — every read hits disk, which is fine at toggle frequency.

> **Cache subtlety:** there is no cache on `readState`, but `isPipelineEnabled` is called per-task in the dispatch loop, meaning a tick with many pending tasks reads `pipeline-state.json` repeatedly. It's a tiny file, so this is acceptable; just don't bloat it.

---

## `utils.ts` — ids and timestamps

```ts
// core/lib/utils.ts:1-16
import { randomBytes } from "crypto";

export function generateId(prefix?: string): string {
  const id = randomBytes(6).toString("hex");
  return prefix ? `${prefix}-${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoMinusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}
```

- `generateId(prefix?)` — `randomBytes(6)` → **12 hex chars** (6 bytes). Optional `prefix-` prefix. This is the task id (and directory name). 6 bytes = 48 bits of randomness — collision-safe for this scale, not a UUID. (`createTask` calls it without a prefix.)
- `nowIso()` — `new Date().toISOString()`, e.g. `2026-06-01T12:34:56.789Z`. Used for `createdAt`/`updatedAt`, attempt timestamps, and log `ts`. Because ISO-8601 strings sort lexicographically in time order, the processor's FIFO `createdAt.localeCompare` and the task-store's reverse sort work correctly on the raw strings.
- `isoMinusDays(days)` — now minus N UTC days, ISO string. A convenience for "recent" windows (used by pipelines/queries, not by core's tick loop).

---

## Where to go next

- [05-task-store.md](05-task-store.md) — the heaviest user of `lock`, `cache`, `io`, and `paths`.
- [03-processor.md](03-processor.md) — uses `log`, `pipelineState`, `paths`, `utils`.
- [09-vault-reader.md](09-vault-reader.md) — uses `cache` and the vault paths.
- [`../best-practices/coding.md`](../best-practices/coding.md) — conventions for adding new utilities consistently.
