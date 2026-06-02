# Dashboard 02 — Routing & Loads

> SvelteKit **file-based routing**: a folder under `dashboard/src/routes/` is a URL segment; `+page.svelte` renders, `+page.server.ts` loads data **server-side only**, `+server.ts` is an API endpoint (covered in [03](./03-api-endpoints.md)). `[brackets]` are dynamic params. This page maps every page route, explains the universal `load` pattern, the client-side polling pattern, and the deliberate absence of form actions.

> Official docs: [SvelteKit routing](https://svelte.dev/docs/kit/routing) · [`load` functions](https://svelte.dev/docs/kit/load). See also the [SvelteKit primer](../primers/sveltekit-primer.md).

---

## 1. The route map

The app is a single `+layout.svelte` shell wrapping one Overview page, one Tasks section, and seven domain sections. The left nav is hard-coded in `dashboard/src/routes/+layout.svelte:9-19`.

### Layout shell

`+layout.svelte` is a fixed sidebar + scrollable main. It imports the global stylesheet and renders children via the Svelte 5 snippet API:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="h-screen flex overflow-hidden">
  <aside class="w-56 shrink-0 bg-sidebar border-r border-border p-4 …">
    <h1 class="…">Command Center</h1>
    <a href="/" …>Overview</a>
    <a href="/tasks" …>Tasks</a>
    <div …>Domains</div>
    <a href="/marketing" …>Marketing</a>
    … (Personal Brand, Vault, Competitors, Reddit PMF, Software Factory, RoleNext)
  </aside>
  <main class="flex-1 min-w-0 p-6 overflow-y-auto h-screen">
    {@render children()}
  </main>
</div>
```

`let { children } = $props()` + `{@render children()}` is the Svelte 5 replacement for `<slot/>` — see the [Svelte 5 primer](../primers/svelte-5-primer.md). There is **no `+layout.server.ts`** — the layout loads no data; each page loads its own.

### Full page-route table

Nav order, with sub-routes nested. `[param]` columns name the dynamic segments and what they decode to.

| Route | File | What it shows | Dynamic param |
|---|---|---|---|
| `/` | `+page.server.ts` / `+page.svelte` | **Overview** — registered pipelines + recent failures | — |
| `/tasks` | `tasks/+page.server.ts` / `.svelte` | **Tasks** — the global task table + per-pipeline control cards | — |
| `/tasks/[id]` | `tasks/[id]/+page.server.ts` / `.svelte` | Single task detail (input/output/attempts/phase outputs) | `[id]` = task id |
| `/marketing` | `marketing/+page.server.ts` / `.svelte` | Marketing domain dashboard (KB, drafts, platforms, tasks) | — |
| `/marketing/kb` | `marketing/kb/+page.server.ts` | KB entry list | — |
| `/marketing/kb/[id]` | `marketing/kb/[id]/+page.server.ts` | One KB entry, **markdown pre-rendered server-side** | `[id]` = KB id |
| `/marketing/drafts` | `marketing/drafts/+page.server.ts` | Draft-set list | — |
| `/marketing/drafts/[slug]` | `marketing/drafts/[slug]/+page.server.ts` / `.svelte` | **Drafts editor** (per-platform tabs) | `[slug]` = draft set |
| `/personal-brand` | `personal-brand/+page.server.ts` / `.svelte` | Personal-brand dashboard (eligible notes, drafts, tasks) | — |
| `/personal-brand/drafts/[slug]` | `personal-brand/drafts/[slug]/+page.server.ts` / `.svelte` | **Brand drafts editor** | `[slug]` = brand draft set |
| `/vault` | `vault/+page.server.ts` / `.svelte` | Vault overview — per-pillar note counts, staging | — |
| `/vault/orphans` | `vault/orphans/+page.server.ts` | Dead wikilinks grouped by source note | — |
| `/vault/[pillar]/[note]` | `vault/[pillar]/[note]/+page.server.ts` / `.svelte` | One vault note + resolved wikilinks | `[pillar]`, `[note]` |
| `/vault/staging/[task]` | `vault/staging/[task]/+page.server.ts` / `.svelte` | Staged-candidate review for a vault-nuggets task | `[task]` = task id |
| `/competitors` | `competitors/+page.server.ts` / `.svelte` | Latest competitor snapshot + archive list | — |
| `/competitors/archive/[date]` | `competitors/archive/[date]/+page.server.ts` | Archived snapshot for a date | `[date]` = `YYYY-MM-DD` |
| `/reddit-pmf` | `reddit-pmf/+page.server.ts` / `.svelte` | Hypotheses + metrics + links awaiting placement | — |
| `/software-factory` | `software-factory/+page.server.ts` / `.svelte` | Housekeeping pipeline status + recent logs | — |
| `/rolenext` | `rolenext/+page.server.ts` / `.svelte` | RoleNext hub (bug-resolver + job-apply summary) | — |
| `/rolenext/bug-resolver` | `rolenext/bug-resolver/+page.server.ts` / `.svelte` | Bug-resolver incidents (post-mortems, **markdown rendered**) | — |
| `/rolenext/bug-resolver/[taskId]` | `rolenext/bug-resolver/[taskId]/+page.server.ts` / `.svelte` | Per-task phase slices (poll→triage→fix→verify→pr→post-mortem) | `[taskId]` |
| `/rolenext/job-apply` | `rolenext/job-apply/+page.server.ts` / `.svelte` | Job-apply runs + per-job prep rows | — |
| `/pipelines/[id]` | `pipelines/[id]/+page.server.ts` / `.svelte` | Generic pipeline detail — phases, gate types, counts | `[id]` = pipeline id |

> **The complete set of dynamic param names in the app** (page + API routes): `[id]`, `[slug]`, `[platform]`, `[pillar]`, `[note]`, `[task]`, `[file]`, `[taskId]`, `[date]`, `[filename]`. They're plain strings off `params.<name>`; SvelteKit does no validation, so the `load`/handler validates (e.g. `vault/[pillar]/[note]/+page.server.ts:8` checks `PILLARS.includes(params.pillar)` and 404s otherwise).

---

## 2. The `load` pattern — server-only, reads the engine directly

Every page's data comes from a `+page.server.ts` `load` function. Because these are `.server.ts`, they run **only on the Node server** and can do anything the engine can: touch the filesystem, call `claude`, read `process.env`. They never reach the browser, so there's no secret-leak risk in importing `core/lib` here.

The canonical shape: **parallel reads with `Promise.all`, each guarded with `.catch(() => default)`** so a single missing file doesn't 500 the whole page. Overview (`+page.server.ts`):

```ts
import { pipelineStatus } from "../../../core/lib/processor.ts";
import { listTasks } from "../../../core/lib/tasks.ts";
import { extractFailures } from "$lib/failures";

export async function load() {
  const [pipelines, tasks] = await Promise.all([pipelineStatus(), listTasks()]);
  const failures = extractFailures(tasks);
  return { pipelines, failures };
}
```

The defensive `.catch` form is everywhere the data is optional. From `marketing/+page.server.ts:9-14`:

```ts
const [kb, drafts, platforms, tasks] = await Promise.all([
  getKBEntries().catch(() => []),
  getDraftSets().catch(() => []),
  getPlatformConfig().catch(() => ({ enabled: [], disabled: [] })),
  listTasksByPipeline("marketing"),
]);
```

Common engine entrypoints used by loads:

| Function | From | Used by |
|---|---|---|
| `listTasks()` | `core/lib/tasks.ts` | Overview, Tasks |
| `listTasksByPipeline(id)` | `core/lib/tasks.ts` | every domain page |
| `getTask(id)` | `core/lib/tasks.ts` | `/tasks/[id]`, `/vault/staging/[task]`, `/rolenext/bug-resolver/[taskId]` |
| `pipelineStatus()` | `core/lib/processor.ts` | Overview, Tasks |
| `readLastProcessorState()` | `core/lib/processor.ts` | Tasks |
| `getPipeline(id)` | `core/lib/registry.ts` | `/pipelines/[id]`, marketing, software-factory |
| `extractFailures(tasks)` / `countTasksByStatus` / `failedCount` | `$lib/failures` (pure, no I/O) | many — see [05](./05-components-and-patterns.md) |

> The `load` return value is delivered to the matching `+page.svelte` as `data` via `$props()`. See [04 — Full-stack trace](./04-full-stack-trace.md) for the full round trip and [`../core/05-task-store.md`](../core/05-task-store.md) for what `listTasks`/`getTask` actually read.

### Param-driven loads + 404s

Dynamic routes pull `params` and throw SvelteKit's `error()` on miss. `tasks/[id]/+page.server.ts:8-12`:

```ts
export async function load({ params }) {
  const task = await getTask(params.id);
  if (!task) throw error(404, `task not found: ${params.id}`);
  const pipeline = getPipeline(task.pipelineId);
  …
}
```

`/vault/[pillar]/[note]` `decodeURIComponent(params.note)`s the filename (note titles contain spaces); `/vault/staging/[task]` additionally guards the pipeline (`if (task.pipelineId !== "vault-nuggets") throw error(400, …)`).

---

## 3. Server-side Markdown rendering (`marked` + `isomorphic-dompurify`)

Three page loads pre-render AI/user-authored Markdown to **sanitized** HTML on the server, so the page can `{@html …}` it safely. The pattern (`marketing/kb/[id]/+page.server.ts`):

```ts
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getKBEntry } from "…/kb.ts";

marked.setOptions({ gfm: true, breaks: false });

export async function load({ params }) {
  const entry = await getKBEntry(params.id);
  if (!entry) throw error(404, `KB entry not found: ${params.id}`);
  const rawHtml = await marked.parse(entry.body ?? "");
  const bodyHtml = DOMPurify.sanitize(rawHtml);   // ← strip any XSS
  return { entry, bodyHtml };
}
```

Same `marked → DOMPurify.sanitize` chain in:
- `marketing/kb/[id]/+page.server.ts` — KB entry bodies,
- `rolenext/bug-resolver/+page.server.ts` — incident post-mortems,
- `rolenext/bug-resolver/[taskId]/+page.server.ts` — per-phase logs/outputs.

> **Rule:** any Markdown that originated from Claude or the user is sanitized **server-side** before it reaches `{@html}`. (The drafts *editors* render markdown client-side with `marked.parse` for live preview — that content is the user's own and never persisted as HTML; see [05 — Markdown sanitization](./05-components-and-patterns.md#server-side-markdown-sanitization).)

---

## 4. Client-side polling — `invalidateAll()` on an interval

The dashboard has no websockets/SSE. Pages stay fresh by **re-running their own `load`** on a timer using SvelteKit's `invalidateAll()`, scheduled inside a Svelte 5 `$effect` (which returns a cleanup function — see [`$effect` docs](https://svelte.dev/docs/svelte/$effect)).

Tasks polls every **3 s** (`tasks/+page.svelte:8-11`):

```svelte
$effect(() => {
  const id = setInterval(() => invalidateAll(), 3000);
  return () => clearInterval(id);     // cleanup on unmount
});
```

Overview polls every **5 s** (`+page.svelte:7-10`) — same pattern, `5000`. `invalidateAll()` tells SvelteKit "all data is stale," which re-invokes the page's `load` and updates `data` reactively; because the load reads live engine state, the table reflects whatever the background processor has done since the last tick. This is the heartbeat of the live UI.

> The `$effect` cleanup (`return () => clearInterval(id)`) is essential — without it, navigating away would leak a forever-firing interval. Svelte runs the returned function on teardown and before each re-run.

---

## 5. No form actions — mutations go through `fetch()` to API routes

> **There are zero `+page.server.ts` `actions` and zero `<form method="POST">` in the app.** Every mutation is a client-side `fetch()` to a `/api/*` `+server.ts` endpoint, followed by `invalidateAll()` (or `location.reload()` on detail pages).

This is a deliberate, consistent architecture. Buttons call small async functions like (`tasks/+page.svelte:32-35`):

```ts
async function approve(id: string) {
  await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
  await invalidateAll();
}
```

Why this shape, not SvelteKit form actions:
- The same endpoints back **both** the UI **and** the OS cron (`POST /api/cron`) — they're a real JSON API, not form-only.
- Bulk operations send JSON bodies (`{ pipelineId }`, `{ status: [...] }`) that map cleanly to `request.json()` server-side.
- After mutating, `invalidateAll()` re-pulls fresh state — no optimistic form-result merging needed (with one exception: vault staging does local optimistic updates, see [05](./05-components-and-patterns.md#optimistic-local-mutation)).

The full endpoint catalogue is [03 — API endpoints](./03-api-endpoints.md).

---

## 6. Putting it together (one route's data flow)

```
GET /tasks
  └─ tasks/+page.server.ts  load()        (server, Node)
        ├─ listTasks()              ──► core/lib/tasks.ts   (reads task.json files)
        ├─ pipelineStatus()         ──► core/lib/processor.ts (uses registry)
        ├─ readLastProcessorState() ──► core/lib/processor.ts
        └─ extractFailures(tasks)   ──► $lib/failures (pure)
              │ returns { tasks, pipelines, lastProcessor, failures }
              ▼
     tasks/+page.svelte   let { data } = $props()
        ├─ renders table from data.tasks  ($derived visibleTasks)
        └─ $effect → setInterval(invalidateAll, 3000)  ← re-runs load() every 3s
```

---

### Cross-links

- [01 — Stack & bootstrap](./01-stack-and-bootstrap.md) — why server code can reach the filesystem.
- [03 — API endpoints](./03-api-endpoints.md) — the `fetch()` targets.
- [04 — Full-stack trace](./04-full-stack-trace.md) — the same flow, end to end with the processor.
- [`../core/05-task-store.md`](../core/05-task-store.md) — `listTasks` / `getTask` internals.
- [SvelteKit primer](../primers/sveltekit-primer.md) · [Svelte 5 primer](../primers/svelte-5-primer.md).
