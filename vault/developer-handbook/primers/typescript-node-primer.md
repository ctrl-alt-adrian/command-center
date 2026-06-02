# TypeScript + Node Primer (the backend language)

The backend of Command Center is **TypeScript running on Node**, written as ES
modules with explicit `.ts` import extensions and `strict` type-checking. The
dashboard's SvelteKit `load()`/`+server.ts` functions import these modules
directly (they run server-side), so `core/lib/*` and `pipelines/*` *are* the
backend. This page teaches the TypeScript/Node patterns this repo actually uses.

Official references: [TypeScript Handbook](https://www.typescriptlang.org/docs/),
[Node API](https://nodejs.org/api/).

> Cross-links: [../core/01-data-model.md](../core/01-data-model.md) (the `Task`
> model below), [../core/10-utilities.md](../core/10-utilities.md) (lock/cache),
> [../best-practices/coding.md](../best-practices/coding.md).

---

## ESM + explicit `.ts` extensions

Both `package.json` files declare `"type": "module"`, so every `.ts`/`.js` file
is an **ES module** — `import`/`export`, no `require`. The distinctive thing
about this repo: imports carry an explicit **`.ts`** extension.

```ts
// core/lib/vault.ts
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { VAULT_ROOT, LEGACY_SESSIONS_ROOT } from "./paths.ts";  // ← .ts, not .js
import { ttlCache } from "./cache.ts";
```

That works because of two compiler options in `dashboard/tsconfig.json`:

```jsonc
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "rewriteRelativeImportExtensions": true,  // .ts → .js in emitted output
    "moduleResolution": "bundler",            // resolve .ts source directly
    "strict": true,
    "checkJs": true,
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

- **`moduleResolution: "bundler"`** lets you import the actual `.ts` source path
  (Vite/SvelteKit bundles it; there's no separate compile step in dev).
- **`rewriteRelativeImportExtensions`** rewrites `./foo.ts` → `./foo.js` in any
  emitted JS, so the code is portable.
- **`strict: true`** turns on the full strictness suite (`noImplicitAny`,
  `strictNullChecks`, etc.) — `npm run check` (svelte-check) enforces it. There
  is no separate root `tsconfig.json`; the dashboard's config governs the whole
  type-check, and the repo root has only `@types/node` + `typescript` as
  devDeps.

---

## Modeling the domain with interfaces

The data model is plain `interface`s in `core/lib/types.ts`. No classes, no
decorators — just shapes. The central one is `Task` (`core/lib/types.ts:91`):

```ts
export interface Task {
  id: string;
  pipelineId: string;
  phaseId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  attempts: TaskAttempt[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;   // ? = optional
  parentId?: string;
  error?: string;
  retryCount?: number;
  gateFailReason?: string;
}
```

Two idioms worth internalizing:

### `Record<string, unknown>` for open-ended bags

`input` and `output` are `Record<string, unknown>` — a typed map from string
keys to *unknown* values. This is the repo's "we don't know the shape yet, and
it's pipeline-specific" type. `unknown` (not `any`) forces a narrowing check
before you use a value, which keeps `strict` happy:

```ts
const url = task.input.pageUrl;                 // type: unknown
if (typeof url === "string") { /* now string */ }
```

### Discriminated unions for closed sets of states

`TaskStatus` and `GateType` are string-literal unions — the legal values are
enumerated, and TypeScript narrows on them in `switch`/`if`
(`core/lib/types.ts:1`):

```ts
export type GateType = "needs_review" | "deterministic" | "auto_pass";

export type TaskStatus =
  | "pending" | "running" | "needs_review" | "completed"
  | "failed" | "paused_backpressure" | "paused_user" | "cleared_stale";
```

Because these are unions of literals, a typo (`"complete"` instead of
`"completed"`) is a compile error, and the dashboard's `STATUS_COLORS` maps key
off exactly these strings. Function-valued interface fields (the pluggable phase
hooks) use the same file — e.g. `check?: (task: Task) => Promise<GateCheckResult>`
on `PhaseConfig` (`core/lib/types.ts:28`).

---

## Async/await everywhere; `node:fs/promises`

Nearly every function in `core/lib` is `async` and uses the promise-based fs API.
([Node fs/promises](https://nodejs.org/api/fs.html#promises-api)) The reader is
representative — `readFile`, plus `readdir({ withFileTypes: true })` for a
recursive walk (`core/lib/vault.ts:131`):

```ts
async function walkDir(dir: string, into: string[] = []): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return into;                       // missing dir → empty, fail soft
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".")) continue;   // skip .staging/, .obsidian/
      await walkDir(p, into);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      into.push(p);
    }
  }
  return into;
}
```

The fs functions you'll meet across the codebase: `readFile`/`writeFile`,
`mkdir(dir, { recursive: true })`, `rm(path, { recursive, force })`,
`readdir`, `stat`, `open` (for the lock), `unlink`. Always with
[`node:path`](https://nodejs.org/api/path.html) (`path.join`, `path.relative`,
`path.basename`, `path.extname`, `path.dirname`) — never string concatenation
for paths.

> **`fail-soft` is a convention here.** Notice the bare `try/catch` returning a
> default. The vault reader does this so a missing pillar dir (the vault is
> gitignored) doesn't crash a dashboard load.

---

## Spawning subprocesses: `node:child_process` `execFile`

The Claude/yt-dlp/gh wrappers shell out with `execFile` (not `exec` — `execFile`
takes an args array, so there's no shell-injection surface). The `claude()`
wrapper is the canonical example (`core/lib/claude.ts:73`):

```ts
import { execFile } from "child_process";

export async function claude(prompt: string, opts: ClaudeOptions | string = {}): Promise<string> {
  const resolved = typeof opts === "string" ? { model: opts } : opts;
  const model = resolved.model ?? "claude-sonnet-4-6";
  return await new Promise<string>((resolve, reject) => {
    const child = execFile(
      "claude",
      ["-p", "--setting-sources", settingSources, "--model", model],
      { maxBuffer: DEFAULT_MAX_BUFFER, timeout: DEFAULT_TIMEOUT_MS, encoding: "utf-8", env: cleanEnv() },
      (error, stdout, stderr) => {
        if (error) { /* classify rate-limit vs hard failure, reject */ }
        else resolve((stdout as string).trim());
      },
    );
    if (child.stdin) { child.stdin.write(prompt); child.stdin.end(); }
  });
}
```

Patterns to copy when wrapping any CLI:

- **`execFile(cmd, args[], opts, cb)`** — args as an array, never an interpolated
  string.
- **Wrap the callback API in a `Promise`** so callers can `await` it.
- Set **`timeout`** and **`maxBuffer`** (`claude.ts:3`) — LLM output is large and
  can hang; defaults here are 120 s and 10 MB.
- **Feed input via stdin** (`child.stdin.write(prompt)`), not argv, for large
  prompts.
- **Classify errors** into typed subclasses — `claude.ts` throws a
  `RateLimitError extends Error` so the processor can requeue instead of failing
  the task.

A small in-module **concurrency gate** (`acquire`/`release` with a `waiters`
queue, `claude.ts:34`) caps simultaneous `claude` processes at
`CLAUDE_CONCURRENCY` (default 8) — a pure-TS semaphore, no library.

---

## `node:crypto` for IDs

ID generation uses `randomBytes` (`core/lib/utils.ts:1`):

```ts
import { randomBytes } from "crypto";

export function generateId(prefix?: string): string {
  const id = randomBytes(6).toString("hex");      // 12 hex chars
  return prefix ? `${prefix}-${id}` : id;
}
```

Elsewhere `createHash` (from the same module) backs content fingerprinting for
dedupe (`pipelines/rolenext/bug-resolver/lib/dedup.ts`).
([Node crypto](https://nodejs.org/api/crypto.html))

---

## Two utilities you'll reach for constantly

### File lock — `withFileLock` (`core/lib/lock.ts`)

An advisory lock built on `fs.open(lockPath, "wx")` — `wx` fails with `EEXIST`
if the file exists, which is an atomic "claim". It steals a lock older than 5 s
(holder assumed crashed) and times out otherwise:

```ts
export async function withFileLock<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  // loop: try fs.open(lockPath, "wx"); on EEXIST, check mtime for staleness,
  // else sleep 25ms and retry until a 5s deadline
  // on success: run fn() in try/finally, unlink the lock in finally
}
```

Generic over `T`, takes a callback — `await withFileLock(taskFile, () => mutate())`
serializes writes to task JSON.

### TTL cache — `ttlCache` (`core/lib/cache.ts`)

A tiny single-flight memoizer for expensive read-only fs scans. Concurrent
callers within the TTL share the *same in-flight promise*; writers call `bust()`:

```ts
export function ttlCache<T>(fn: () => Promise<T>, ttlMs: number): TtlCache<T> {
  let cached: { promise: Promise<T>; expiresAt: number } | null = null;
  return {
    get() {
      const now = Date.now();
      if (cached && cached.expiresAt > now) return cached.promise;
      const promise = fn().catch((err) => { if (cached?.promise === promise) cached = null; throw err; });
      cached = { promise, expiresAt: now + ttlMs };
      return promise;
    },
    bust() { cached = null; },
  };
}
```

The vault reader wraps its whole-vault scan in one
(`ttlCache(() => listNotesUncached(VAULT_ROOT), 5000)`, `core/lib/vault.ts:161`)
and busts it after embed. See [../core/10-utilities.md](../core/10-utilities.md).

---

## Running a `.ts` file (and tests)

There is no compile step in normal use: the dashboard runs `.ts` directly
through **Vite/SvelteKit** (`npm run dev`), and `npm run check` type-checks via
svelte-check. The shared `core/lib` and `pipelines` modules are imported into
those server functions, so they execute under the same toolchain.

For **standalone scripts and tests**, the repo uses a zero-dependency test
harness built on **`node:assert`** — no Jest/Vitest. The single test file,
`pipelines/rolenext/bug-resolver/lib/dedup.test.ts`, shows the shape:

```ts
import assert from "node:assert/strict";
import { computeFingerprint, extractPageUrl } from "./dedup.ts";

let passed = 0, failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${(err as Error).message}`); failed++; }
}

test("URL query and trailing slash dropped", () => {
  const a = computeFingerprint("https://example.com/tracker/?utm=foo", "Bug body here");
  const b = computeFingerprint("https://EXAMPLE.com/tracker", "Bug body here");
  assert.equal(a, b);
});

setImmediate(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
```

It's a plain Node program: define a `test()` helper, call `assert.equal` /
`assert.notEqual` from `node:assert/strict`, tally pass/fail, and
`process.exit(1)` on failure so CI/the shell sees a non-zero code. Run it with a
TS-aware Node runner (e.g. `node --experimental-strip-types <file>.ts`, or
`tsx`/`npx tsx <file>.ts` if installed). The point is it imports the **`.ts`
source** under test directly — same `.ts`-extension convention as production.

> **`node:` prefix.** Built-in modules are imported with the explicit `node:`
> scheme in newer code (`node:assert/strict`, `node:crypto`). Older files use the
> bare specifier (`"crypto"`, `"fs/promises"`); both resolve to the same builtin.
> Prefer `node:` in new code — it's unambiguous and future-proof.

---

## Quick reference

| Need | This repo |
|---|---|
| Module system | ESM (`"type": "module"`), `import`/`export` |
| Import extension | explicit `.ts` (`rewriteRelativeImportExtensions` + bundler resolution) |
| Type-check | `npm run check` (svelte-check, `strict: true`) |
| Data model | `interface` in `core/lib/types.ts`; no classes |
| Open-ended data | `Record<string, unknown>` + narrowing |
| Closed state sets | string-literal unions (`TaskStatus`, `GateType`) |
| File I/O | `node:fs/promises` + `node:path`, fail-soft try/catch |
| Subprocess | `execFile(cmd, args[], opts, cb)` wrapped in a Promise |
| IDs / hashing | `node:crypto` `randomBytes` / `createHash` |
| Concurrency / locks | hand-rolled semaphore (`claude.ts`), `withFileLock` (`lock.ts`) |
| Caching | `ttlCache` (`cache.ts`) |
| Tests | `node:assert/strict`, custom `test()` runner, `process.exit` |

---

## See also

- [../core/01-data-model.md](../core/01-data-model.md) — the `Task`/`Phase`/`Pipeline` types in depth.
- [../core/10-utilities.md](../core/10-utilities.md) — lock, cache, io helpers.
- [sveltekit-primer.md](./sveltekit-primer.md) — where these modules get imported (loads & endpoints).
- [../best-practices/coding.md](../best-practices/coding.md) — project coding rules.
