# Best Practices — Coding Conventions

This is the rulebook for writing code in Command Center that *stays* consistent with the rest of the system after you are the only one running it. Every rule below is grounded in a real pattern already in the repo, with a GOOD/BAD pair and a WHY. When in doubt, copy an existing pipeline — the conventions are load-bearing, not cosmetic.

Related reading:

- [coding ← you are here] · [implementing-features](implementing-features.md) · [testing](testing.md)
- Core internals: [processor](../core/03-processor.md) · [gates](../core/04-gates.md) · [task store](../core/05-task-store.md) · [claude wrapper](../core/06-claude-wrapper.md) · [registry & bootstrap](../core/07-registry-bootstrap.md) · [utilities](../core/10-utilities.md)
- Primers: [TypeScript/Node](../primers/typescript-node-primer.md) · [Svelte](../primers/svelte-best-practices.md)
- [Getting started](../03-getting-started.md) · [Troubleshooting](../operations/troubleshooting.md)

---

## 1. Never modify `core/lib/` to add a domain

Domains plug in through `pipelines/<name>/` plus a single registration line. `core/lib/` is the domain-agnostic runtime — it must not learn about marketing, competitors, personal-brand, or anything else.

The README states it plainly (`README.md:44`): *"That's it — `core/lib/` is never modified."* And the bootstrap header (`core/lib/registry-bootstrap.ts:1-2`) says: *"core/lib/ does not import any pipeline-specific code other than through this file."*

**BAD**

```ts
// core/lib/processor.ts
if (task.pipelineId === "marketing") {
  await markKbUsed(task);   // ❌ core now knows about marketing
}
```

**GOOD**

```ts
// pipelines/marketing/pipeline.config.ts — behavior lives in the phase
const reviewPhase: PhaseConfig = {
  id: "review",
  gateType: "needs_review",
  // pipeline-specific side effects stay in the pipeline, expressed through
  // the generic PhaseConfig hooks (run/check/fanOut/onExhausted).
};
```

**WHY** — The entire value of the runtime is that it is one primitive (phases + gates) reused across every domain. The moment `core/` branches on a pipeline id, every new domain risks a core edit, every core edit risks every domain, and the "add a pipeline in 4 steps" contract in [registry & bootstrap](../core/07-registry-bootstrap.md) breaks. If you need new generic capability, add a *generic* field to `PhaseConfig`/`PipelineConfig` in `core/lib/types.ts` (the way `fanOut`, `onExhausted`, `fanOutBatchSize`, `perTickCap` were added) — never a domain check.

---

## 2. All task writes go through `withFileLock` + bust the cache

The task store is JSON files on disk read/written by **two processes** — the dashboard and the cron-driven processor. Concurrent read-modify-write loses updates. Every mutation in `core/lib/tasks.ts` wraps the read→mutate→write in `withFileLock` (`core/lib/lock.ts`) and calls `tasksCache.bust()` before returning.

**BAD**

```ts
// ❌ lost-update race: two writers read the same task, both Object.assign,
//    last writer wins and silently drops the other's change. Cache also goes stale.
const raw = await fs.readFile(taskFile(id), "utf-8");
const task = JSON.parse(raw);
task.status = "completed";
await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
```

**GOOD** (`core/lib/tasks.ts:85-97`)

```ts
export async function updateTask(id, updates) {
  return withFileLock(taskFile(id), async () => {
    const task = await getTask(id);          // read INSIDE the lock
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: nowIso() });
    await fs.writeFile(taskFile(id), JSON.stringify(task, null, 2), "utf-8");
    tasksCache.bust();                        // invalidate so next read is fresh
    return task;
  });
}
```

**WHY** — `withFileLock` is an advisory `O_EXCL` lock on a `.lock` sibling with a 5s steal-on-crash timeout (`core/lib/lock.ts:11-44`). Reading the task *inside* the lock is what makes the read-modify-write atomic; reading before acquiring the lock reintroduces the race. Busting the cache is mandatory — the 2s TTL cache (rule 3) would otherwise serve a stale task to the dashboard for up to 2 seconds. Don't hand-roll a new task writer; add to `tasks.ts` and inherit the lock+bust for free. See [task store](../core/05-task-store.md).

---

## 3. Reads go through `ttlCache` (single-flight), not raw fs walks per request

The original dashboard lag came from `load()` functions re-walking the filesystem on every navigation with serial reads — *"`/vault` did ~1,400 sequential `readFile`s per navigation"* (`OPTIMIZATION_HANDOFF.md:7`). The fix was a tiny single-flight TTL memoizer (`core/lib/cache.ts`) plus parallel reads.

**BAD**

```ts
// ❌ serial readFile loop, re-run on every single request — N+1, no caching
const ids = await fs.readdir(TASKS_DIR);
const tasks = [];
for (const id of ids) {
  const raw = await fs.readFile(taskFile(id), "utf-8");  // one await per file, sequential
  tasks.push(JSON.parse(raw));
}
```

**GOOD** (`core/lib/tasks.ts:42-78`)

```ts
async function listTasksUncached(): Promise<Task[]> {
  const entries = await fs.readdir(TASKS_DIR).catch(() => []);
  const loaded = await Promise.all(entries.map((e) => getTask(e)));  // parallel
  return loaded.filter((t): t is Task => t !== null) /* …sort… */;
}
const tasksCache = ttlCache(listTasksUncached, 2000);  // 2s single-flight cache
export async function listTasks() { return tasksCache.get(); }
```

**WHY** — `ttlCache(fn, ttlMs)` (`core/lib/cache.ts:12-30`) gives two wins at once: concurrent callers within the TTL share *one* in-flight promise (single-flight — no thundering herd of fs scans), and results are reused until the TTL expires. Pair it with `Promise.all` so the underlying scan is parallel, not serial. The accepted tradeoff is bounded staleness (2s for tasks, 5s for vault notes — `OPTIMIZATION_HANDOFF.md:42-44`); write paths bust the cache so dashboard-driven changes are never stale. The processor runs in a separate process and bypasses the in-dashboard cache, hence the short TTL. Do **not** add a new per-request fs walk to a `load()` — route it through a cached `list*()` in core.

---

## 4. Use the `io.ts` helpers, not hand-rolled `fs` + `JSON.parse`

`core/lib/io.ts` centralizes the four JSON-on-disk patterns: `readJson<T>(path, fallback)`, `readJsonOrNull<T>(path)`, `writeJson(path, data)`, `safeReaddir(dir)`. They swallow the "missing file / bad JSON" errors that nearly every caller wants swallowed anyway, in one place.

This module exists *because* the same code was duplicated per-pipeline. The optimization pass deleted `pipelines/marketing/lib/files.ts` and re-pointed four marketing imports at the new core module (`OPTIMIZATION_HANDOFF.md:51-52`).

**BAD**

```ts
// ❌ hand-rolled, repeated in every pipeline lib, each with its own try/catch
let state;
try {
  state = JSON.parse(await fs.readFile(stateFile, "utf-8"));
} catch {
  state = { channels: {} };
}
```

**GOOD** (`core/lib/tasks.ts:38-40`, `core/lib/processor.ts:50-54`)

```ts
import { readJson, readJsonOrNull, writeJson, safeReaddir } from "../../core/lib/io.ts";

const state = await readJson<ChannelState>(stateFile, { channels: {} });
const task  = await readJsonOrNull<Task>(taskFile(id));          // null on miss
const files = await safeReaddir(SLOP_RULES_DIR);                 // [] on missing dir
await writeJson(stateFile, state);
```

**WHY** — Centralizing means one definition of "what counts as a recoverable read error," consistent fallbacks, and no scattered try/catch. **One deliberate exception**: `pipelines/rolenext/bug-resolver/lib/state.ts` keeps its own stricter `readJsonOr` that swallows *only* `ENOENT` and re-throws everything else, to protect fingerprint-store integrity (`OPTIMIZATION_HANDOFF.md:64-65`). The rule is "use `io.ts` unless you have a corruption-safety reason to be stricter" — and if you do, document it like that file does.

---

## 5. Centralize paths in `paths.ts` — never hardcode `tasks/` or `vault/`

Every filesystem location derives from `COMMAND_CENTER_ROOT` in `core/lib/paths.ts`, which is env-overridable. Pipelines export their own `paths.ts` that build on the core constants.

**BAD**

```ts
// ❌ brittle relative climb; breaks the moment the file moves, untestable, not env-overridable
const root = path.resolve(__dirname, "..", "..", "..", "..", "..");
const tasksDir = path.join(root, "tasks");
```

**GOOD** (`core/lib/paths.ts:3-25`)

```ts
import { COMMAND_CENTER_ROOT, VAULT_ROOT, TASKS_DIR, taskFile, phaseDir } from "../../core/lib/paths.ts";
// COMMAND_CENTER_ROOT = process.env.COMMAND_CENTER_ROOT ?? path.resolve(import.meta.dirname, "..", "..")
```

**WHY** — The optimization pass specifically replaced a `path.resolve(__dirname, "..", "..", "..", "..", "..")` chain with the `COMMAND_CENTER_ROOT` import (`OPTIMIZATION_HANDOFF.md:67-69`). Counting `..` segments is fragile, silently wrong after a refactor, and can't be redirected for tests or a relocated install. `paths.ts` reads `COMMAND_CENTER_ROOT`/`VAULT_ROOT` from the environment with a sane default, so the same code works in dev, prod, and (eventually) tests. Always import the helper; never recompute a root.

---

## 6. Claude calls go through `core/lib/claude.ts` — handle `RateLimitError` by requeue

`claude(prompt, opts)` wraps `claude -p` with a concurrency semaphore (`CLAUDE_CONCURRENCY`, default 8) and rate-limit detection that throws a typed `RateLimitError` (`core/lib/claude.ts:34-117`). Never spawn `claude` yourself.

**BAD**

```ts
// ❌ bypasses the semaphore (unbounded concurrent claude processes), no rate-limit
//    detection, leaks CLAUDECODE env into the child, and a 429 fails the task forever.
import { execFile } from "child_process";
execFile("claude", ["-p"], (e, out) => { /* … */ });
```

**GOOD** — call the wrapper, and let the processor handle rate limits:

```ts
// in a phase run():
import { claude } from "../../core/lib/claude.ts";
const content = await claude(prompt, { model: "claude-sonnet-4-6", timeoutMs: 5 * 60 * 1000 });
```

```ts
// core/lib/processor.ts:196-203 — the processor already does the right thing:
if (err instanceof RateLimitError) {
  // Don't fail the task — put it back in the queue; next tick retries once the limit clears.
  await updateTask(task.id, { status: "pending" });
  return;
}
```

**WHY** — The semaphore is the *only* thing bounding Anthropic API concurrency (the per-tick cap and `Promise.all` in the processor deliberately defer to it — `core/lib/processor.ts:129-131`). Shelling out directly removes that bound and can trigger your own rate limits. The wrapper also strips `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT` from the child env so nested `claude` calls don't confuse the CLI (`core/lib/claude.ts:6-11`). Critically: a rate limit is **transient** — failing the task on a 429 throws away work that would have succeeded on the next tick. Throw/propagate `RateLimitError` (the wrapper does this for you) and let the processor requeue. See [claude wrapper](../core/06-claude-wrapper.md).

---

## 7. Parallelize independent async work with `Promise.all` — but respect the claude semaphore

Independent IO and independent claude calls should overlap, not run serially. The semaphore in `claude.ts` keeps that safe even when you fan out many calls at once.

**BAD**

```ts
// ❌ six serial claude calls; ~6× wall-clock for no reason
for (const platform of BRAND_PLATFORMS) {
  const content = await claude(promptFor(platform));
  await fs.writeFile(`${dir}/${platform}.md`, content);
}
```

**GOOD** (`pipelines/personal-brand/lib/generate.ts:73-93`)

```ts
// All platforms in parallel; allSettled so one platform failing doesn't kill the rest.
const settled = await Promise.allSettled(
  BRAND_PLATFORMS.map(async (platform) => {
    const content = await claude(promptFor(platform), { model, timeoutMs: 5 * 60 * 1000 });
    await fs.writeFile(path.join(draftDir, `${platform}.md`), content, "utf-8");
    return [platform, content] as const;
  }),
);
```

```ts
// load() functions do the same for independent reads (dashboard/src/routes/personal-brand/+page.server.ts):
const [eligible, drafts, tasks] = await Promise.all([
  discoverBrandCandidates().catch(() => []),
  getBrandDraftSets().catch(() => []),
  listTasksByPipeline("personal-brand"),
]);
```

**WHY** — `Promise.all`/`Promise.allSettled` overlap independent work; the claude semaphore caps the *actual* API concurrency so fanning out 6 (or 60) calls won't hammer the API. Use `allSettled` when partial success is acceptable (one platform draft failing should still ship the other five — note how each platform records `{ content }` or `{ error }` in `generate.ts:95-104`); use `all` when any failure should reject the whole operation. Don't serialize independent awaits in a `for` loop.

---

## 8. Degrade gracefully in `load()` — one bad file must not 500 the page

A `load()` reads many sources. If one is missing or corrupt, render the rest rather than failing the whole page.

**BAD**

```ts
// ❌ a single missing drafts dir throws → 500 → the entire page is unusable,
//    even though the task list and eligibility scan were fine.
const drafts = await getBrandDraftSets();
const eligible = await discoverBrandCandidates();
```

**GOOD** (`dashboard/src/routes/personal-brand/+page.server.ts:7-11`)

```ts
const [eligible, drafts, tasks] = await Promise.all([
  discoverBrandCandidates().catch(() => []),   // bad vault scan → empty, page still renders
  getBrandDraftSets().catch(() => []),          // missing drafts dir → empty
  listTasksByPipeline("personal-brand"),        // this one we WANT to surface if it breaks
]);
```

**WHY** — Each `.catch(() => default)` isolates a failure to one tile of the page instead of the whole route. Be deliberate about which reads you protect: optional, best-effort data (eligibility preview, drafts list) gets a catch; the spine of the page may be allowed to throw. The processor follows the same philosophy for *observability* writes — `persistProcessorState` is wrapped in try/catch with the comment *"best-effort; processor state is observability, not correctness"* (`core/lib/processor.ts:45-47`).

---

## 9. No `confirm()` dialogs on action buttons

Clicking an action button **is** the confirmation. Rerun, clear, approve, reject, delete, resume — none of them pop a `confirm()`.

**BAD**

```ts
async function clearFailed(pipelineId?: string) {
  if (!confirm("Clear all failed tasks?")) return;   // ❌ extra friction, never used in this codebase
  await fetch("/api/tasks/clear", { method: "POST", /* … */ });
  await invalidateAll();
}
```

**GOOD** (`dashboard/src/routes/tasks/+page.svelte:72-79`)

```ts
async function clearFailed(pipelineId?: string) {
  await fetch("/api/tasks/clear", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId }),
  });
  await invalidateAll();
}
```

**WHY** — This is a stated project rule: *"clicking the button IS the confirmation; skip `confirm()` on rerun/clear/approve/delete."* The dashboard is a single-operator cockpit; every action is reversible enough (rerun re-queues, clear only removes failed/completed tasks) that a modal is pure friction. After the action, call `invalidateAll()` so the UI reflects the new state. Note the consistent fetch shape — `fetch(url, {method, headers, body}); await invalidateAll();` — reuse it for every new action.

---

## 10. No Claude / Anthropic attribution in commits, PRs, or comments

Hard rule, captain-ruled global (`HANDOFF.md:170`). `Co-Authored-By: Claude` and `🤖 Generated with Claude Code` are banned from commit messages, PR titles/bodies, issue bodies, release notes, and code comments.

**BAD**

```
fix: rewind gate retry to previous phase

Co-Authored-By: Claude <noreply@anthropic.com>   ❌
🤖 Generated with Claude Code                      ❌
```

**GOOD**

```
fix: rewind gate retry to previous phase

Marketing slop-retry re-ran the gate against the same drafts. Rewind to
generate with gateRetryFeedback so a fresh artifact is produced.
```

**WHY** — Stated preference, applied repeatedly. Note the distinction: importing `@anthropic-ai/sdk`, calling the `claude` CLI, or referencing "Claude" as a *feature/provider* is fine — only lines that credit Claude/Anthropic as an **author/generator** are banned. Re-read the commit message before `git commit` and strip any attribution a template or harness suggested.

---

## 11. ESM, explicit `.ts` import extensions, strict TS — run `npm run check`

The whole repo is `"type": "module"` and imports with explicit `.ts` extensions (Node strips types natively here). There is no `tsc` build step for the core/pipelines code; the type gate is `svelte-check`.

**BAD**

```ts
import { claude } from "../../core/lib/claude";        // ❌ no extension — fails ESM resolution
const x: any = await readJson(...);                     // ❌ any defeats the point of strict TS
```

**GOOD** (every file in `core/` and `pipelines/`)

```ts
import { claude } from "../../core/lib/claude.ts";      // explicit .ts
import type { PipelineConfig, Task } from "../../core/lib/types.ts";  // type-only import
const state = await readJson<ChannelState>(file, { channels: {} });   // typed
```

**WHY** — Native ESM + Node type-stripping requires the real file extension in the specifier (you'll see `.ts` everywhere — `tasks.ts:3-8`, `processor.ts:2-20`). `import type` keeps type-only imports from emitting runtime requires. Before considering *any* change done, run the project's one verification gate:

```bash
npm run check      # from repo root → cd dashboard && svelte-kit sync && svelte-check
```

It type-checks the dashboard *and* the core/pipelines code it imports (~407 files, target: 0 errors / 0 warnings — `HANDOFF.md:50`). See [TypeScript/Node primer](../primers/typescript-node-primer.md) and [testing](testing.md) — `npm run check` is the primary gate there too.

---

## 12. Idempotent registration and setup scripts

Re-running registration or setup must be safe. `registerPipeline` overwrites; `setup.sh` greps-out and re-adds its cron lines.

**BAD**

```ts
// ❌ throws on the second call (dev HMR re-evaluates bootstrap → crash)
export function registerPipeline(config) {
  if (pipelines.has(config.id)) throw new Error("already registered");
  pipelines.set(config.id, config);
}
```

```bash
# ❌ appends a duplicate cron line every time setup.sh runs
crontab -l > tmp; cat cron/cron.txt >> tmp; crontab tmp
```

**GOOD** (`core/lib/registry.ts:5-12`, `setup.sh`)

```ts
export function registerPipeline(config: PipelineConfig): void {
  if (config.phases.length === 0) throw new Error(`Pipeline ${config.id} has no phases`);
  // Idempotent: overwrite is fine. Dev-mode HMR re-evaluates bootstrap.
  pipelines.set(config.id, config);
}
```

```bash
# setup.sh — strip our own lines, then re-add. Re-runnable any number of times.
crontab -l 2>/dev/null | grep -v 'command-center' > "$TMP" || true
cat "$CRON_FILE" >> "$TMP"
crontab "$TMP"
```

**WHY** — Dev-mode HMR re-evaluates `bootstrapPipelines()`, so a throw-on-duplicate registry would crash on every save. Setup scripts get re-run during recovery and onboarding; a non-idempotent one corrupts the crontab. Tag your cron lines with the `command-center` marker so `setup.sh`'s `grep -v` can find and replace exactly its own entries. See [registry & bootstrap](../core/07-registry-bootstrap.md) and [implementing-features](implementing-features.md) for the add-a-pipeline playbook.
