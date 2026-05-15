# Dashboard Optimization — Handoff

Mid-flight optimization work. Waves 1 & 2 complete and type-checking; Wave 3 not started. **Nothing is committed yet** — `git status` will show the full set of edits from this session plus pre-existing dirty files.

## Original problem

Tab switches in the SvelteKit dashboard were noticeably laggy. Root cause: every `+page.server.ts` `load()` re-walked the filesystem with serial reads and N+1 patterns. Worst offender: `/vault` did ~1,400 sequential `readFile`s per navigation.

## Wave 1 — Performance (DONE)

Goal: kill the tab-switch lag.

**New module**
- `core/lib/cache.ts` — `ttlCache(fn, ttlMs)` with single-flight semantics (concurrent callers within TTL share the in-flight promise; `bust()` invalidates).

**`core/lib/tasks.ts`**
- `listTasks()` parallelized with `Promise.all` (was a `for…await` loop).
- Wrapped in 2s TTL cache.
- `bustTasksCache()` exported; called inside `createTask`, `updateTask`, `appendAttempt`, `deleteTask`.
- `getTask()` collapsed to one-liner using `readJsonOrNull` (see Wave 2).

**`core/lib/vault.ts`**
- `listNotes()` parallelized.
- Wrapped in 5s TTL cache (default-root + all-pillars only — pillar-scoped/alternate-root scans bypass).
- `bustNotesCache()` exported.
- `listOrphanLinks(notes?)` now optionally accepts pre-loaded notes (kills duplicate full scan).

**`pipelines/vault-nuggets/lib/embed.ts`**
- Calls `bustNotesCache()` after embedding new notes/stubs.

**`core/lib/processor.ts`**
- `pipelineStatus()` no longer N+1: one `listTasks()` call, group by `pipelineId` in memory. Was 8× full task-dir scans per call.

**`dashboard/src/routes/vault/+page.server.ts`**
- Passes loaded `notes` into `listOrphanLinks(notes)`.

**`pipelines/rolenext/bug-resolver/phases/poll-issues.ts`**
- Hoisted `listTasksByPipeline(PIPELINE_ID)` from 5 sites to 2. The two remaining are `tasksBefore`/`tasksAfter` around `escalateStale` (which mutates) — kept deliberately. The in-loop and post-loop sites now reuse `tasksAfter`.
- Helper signatures changed to accept `existing: Task[]` / `allTasks: Task[]`.

**Tradeoffs accepted**
- Up to 5s staleness for vault notes mutated outside the dashboard.
- Up to 2s staleness for tasks mutated by the processor (which runs in a separate process and bypasses the in-dashboard cache).
- If either becomes a problem, lower the TTL in `cache.ts` callers in `tasks.ts` / `vault.ts`.

## Wave 2 — Server helpers (DONE)

Goal: DRY the loaders, kill duplicate IO patterns.

**New module**
- `core/lib/io.ts` — `readJson<T>(path, fallback)`, `readJsonOrNull<T>(path)`, `writeJson(path, data)`, `safeReaddir(dir)`.
- Replaced the duplicate copy at `pipelines/marketing/lib/files.ts` (**deleted**). Updated 4 marketing imports (`config.ts`, `signals.ts`, `drafts.ts`, `dedup.ts`) to point at the new core module.

**Migrated to `readJson*`**
- `core/lib/tasks.ts` (`getTask`)
- `core/lib/processor.ts` (`readLastProcessorState`)
- `pipelines/competitors/lib/state.ts` (`readChannelState`, `writeChannelState`)
- `pipelines/competitors/lib/scrape.ts` (`loadLatest` + `loadByDate` — also collapsed nested try/catches)
- `pipelines/personal-brand/lib/drafts.ts` (`readMeta`)
- `pipelines/reddit-pmf/lib/hypotheses.ts` (`loadHypotheses`)
- `dashboard/src/routes/reddit-pmf/+page.server.ts` (metrics-latest read)
- `dashboard/src/routes/rolenext/bug-resolver/[taskId]/+page.server.ts` — also **parallelized** the phase-slice loop *and* per-phase file stats (`Promise.all` over phase dirs, then over file stats within each). Significant win on the bug-resolver detail page.

**Deliberately skipped**
- `pipelines/rolenext/bug-resolver/lib/state.ts` — its local `readJsonOr` is intentionally stricter (swallows only `ENOENT`, re-throws everything else). Protects fingerprint store integrity. Don't migrate.

**Path helpers**
- `dashboard/src/routes/rolenext/bug-resolver/+page.server.ts` — replaced `path.resolve(__dirname, "..", "..", "..", "..", "..")` with `COMMAND_CENTER_ROOT` import from `core/lib/paths.ts`.
- `pipelines/rolenext/bug-resolver/phases/post-mortem.ts` — same; uses `VAULT_ROOT` from `core/lib/paths.ts` directly. Dropped the `fileURLToPath`/`__dirname` shim.

**`dashboard/src/lib/failures.ts`**
- Added `countTasksByStatus(tasks): Record<TaskStatus, number>` and `failedCount(tasks): number`.
- Migrated callers: `rolenext/+page.server.ts`, `competitors/+page.server.ts`, `vault/+page.server.ts`, `software-factory/+page.server.ts`, `reddit-pmf/+page.server.ts`, `personal-brand/+page.server.ts`.

**Frontmatter unified**
- `dashboard/src/routes/rolenext/bug-resolver/+page.server.ts` now uses `parseFrontmatter` from `core/lib/vault.ts` (js-yaml). Dropped 22 lines of ad-hoc YAML parsing. Also parallelized `loadIncidents()` (was a sequential `for` over incident dirs).

## Wave 3 — Frontend dedup (TODO)

Goal: ~250 lines collapsed across the dashboard. Pure extraction, lowest risk.

**Components to extract**
1. `dashboard/src/lib/StatCard.svelte` — the label/count/subtitle block. ~15 sites across overview pages (marketing, vault, personal-brand, reddit-pmf). Props: `label`, `count`, `subtitle?`, `variant?`.
2. `dashboard/src/lib/PipelineActions.svelte` — the rerun-failed / clear-failed / run-discovery button cluster shared by 7 pipeline pages (tasks, marketing, personal-brand, vault, competitors, reddit-pmf, software-factory). Props: `failedCount`, `pipelineId`, optional discovery button slot.

**Helpers to extract** (under `dashboard/src/lib/`)
3. `statusColors.ts` — pull the `STATUS_COLORS` constant duplicated in 8+ `+page.svelte` files. Also `STATUS_BADGE` variants used by tasks page.
4. `taskActions.ts` — wrap the `await fetch("/api/tasks/:id/{approve,reject,rerun}", {method:"POST"}); await invalidateAll();` shape.
5. `pipelineActions.ts` — wrap the batch shape: `await fetch("/api/tasks/{rerun,clear,resume}", {method:"POST", body:JSON.stringify({pipelineId, ...})}); await invalidateAll();`. ~13 call sites.
6. `useRefresh.ts` — Svelte 5 rune helper for the `$effect(() => { const id = setInterval(() => invalidateAll(), 5000); return () => clearInterval(id); })` block duplicated across 14 routes.

**Explicitly NOT doing**
- `@apply` for button classes — Tailwind utility soup is fine; component extraction is the better dedup unit.
- `phasePipeline<I,O>` helper for bug-resolver phases — real ~50-line/phase dedup but each phase has different gate/check semantics. Defer until adding a new phase forces the abstraction.
- Per-request memoization via `event.locals` — TTL cache is good enough; revisit only if staleness bites.

## How to verify

```
cd dashboard && npm run check
```

Currently passes with 0 errors / 0 warnings. Run after every Wave 3 component extraction.

## Files dirty in this session

Run `git status` to see the full list. Pre-existing dirty files (from before this work) are mixed in — be careful when staging.

**New files (uncommitted):**
- `core/lib/cache.ts`
- `core/lib/io.ts`
- `OPTIMIZATION_HANDOFF.md` (this file)

**Deleted (uncommitted):**
- `pipelines/marketing/lib/files.ts`

**Modified by this session (Waves 1+2):**
- `core/lib/tasks.ts`
- `core/lib/vault.ts`
- `core/lib/processor.ts`
- `pipelines/vault-nuggets/lib/embed.ts`
- `pipelines/competitors/lib/state.ts`
- `pipelines/competitors/lib/scrape.ts`
- `pipelines/personal-brand/lib/drafts.ts`
- `pipelines/reddit-pmf/lib/hypotheses.ts`
- `pipelines/marketing/lib/{config,signals,drafts,dedup}.ts` (import path changes only)
- `pipelines/rolenext/bug-resolver/phases/poll-issues.ts`
- `pipelines/rolenext/bug-resolver/phases/post-mortem.ts`
- `dashboard/src/lib/failures.ts`
- `dashboard/src/routes/vault/+page.server.ts`
- `dashboard/src/routes/reddit-pmf/+page.server.ts`
- `dashboard/src/routes/rolenext/+page.server.ts`
- `dashboard/src/routes/rolenext/bug-resolver/+page.server.ts`
- `dashboard/src/routes/rolenext/bug-resolver/[taskId]/+page.server.ts`
- `dashboard/src/routes/competitors/+page.server.ts`
- `dashboard/src/routes/software-factory/+page.server.ts`
- `dashboard/src/routes/personal-brand/+page.server.ts`

**Suggested commit split:** Wave 1 in one commit, Wave 2 in another — each is self-contained and reviewable on its own.

## Resume instructions

To continue: open this file, then say "go on Wave 3" or pick specific items from the Wave 3 list. The full original audit (with line counts and call sites for every Wave 3 candidate) is in this conversation's history if more detail is needed.
