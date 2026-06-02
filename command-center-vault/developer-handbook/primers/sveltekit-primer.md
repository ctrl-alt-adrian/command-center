# SvelteKit 2 Primer (for this repo)

SvelteKit is the application framework wrapping Svelte: file-based routing,
server-side `load()` functions, API endpoints, and an adapter that builds the
deployable artifact. This repo runs **SvelteKit 2.57** with **adapter-node** on
**port 3001**. This page is the SvelteKit half of the story — see
[svelte-5-primer.md](./svelte-5-primer.md) for the component/rune half.

> Mirrors the dashboard pages
> [../dashboard/02-routing-and-loads.md](../dashboard/02-routing-and-loads.md)
> and [../dashboard/03-api-endpoints.md](../dashboard/03-api-endpoints.md) —
> read those for the project-specific tour; this is the framework primer.

---

## File-based routing

Routes live under `dashboard/src/routes/`. **The directory structure *is* the
URL structure.** Special filenames have meaning.
([docs: routing](https://svelte.dev/docs/kit/routing))

| File | Role | Runs on |
|---|---|---|
| `+page.svelte` | the page UI (a Svelte component) | server (SSR) + client |
| `+page.server.ts` | server `load()` — fetch data for the page | **server only** |
| `+layout.svelte` | wraps child pages; renders `{@render children()}` | server + client |
| `+layout.server.ts` | server `load()` shared by all child pages | server only |
| `+server.ts` | an **API endpoint** (`GET`/`POST`/`PUT`/`DELETE`) | server only |
| `+error.svelte` | error boundary for the subtree | server + client |

### URL mapping

```
src/routes/+page.svelte                     →  /
src/routes/tasks/+page.svelte               →  /tasks
src/routes/vault/[pillar]/+page.svelte      →  /vault/:pillar
src/routes/vault/[pillar]/[note]/+page.svelte → /vault/:pillar/:note
src/routes/api/cron/+server.ts              →  /api/cron        (endpoint)
src/routes/api/tasks/[id]/approve/+server.ts →  /api/tasks/:id/approve
```

A `[param]` directory is a dynamic segment; its value shows up as
`params.param` in `load()` and endpoints. The vault routes are a clean example:
`/vault`, `/vault/[pillar]`, `/vault/[pillar]/[note]`, `/vault/orphans`,
`/vault/staging/[task]` (see [how-content-lands](../vault/02-how-content-lands.md)).

---

## `load()` functions

A `+page.server.ts` exports an async `load()`. It runs **on the server**, can
touch the filesystem / spawn processes / read secrets, and returns a plain
object that becomes the page's `data` prop.
([docs: load](https://svelte.dev/docs/kit/load))

Real example — the tasks page composes three data sources in parallel
(`tasks/+page.server.ts`):

```ts
import { listTasks } from "../../../../core/lib/tasks.ts";
import { pipelineStatus, readLastProcessorState } from "../../../../core/lib/processor.ts";
import { extractFailures } from "$lib/failures";

export async function load() {
  const [tasks, pipelines, lastProcessor] = await Promise.all([
    listTasks(),
    pipelineStatus(),
    readLastProcessorState(),
  ]);
  const failures = extractFailures(tasks);
  return { tasks, pipelines, lastProcessor, failures };
}
```

The component receives it via `$props()` (`tasks/+page.svelte:5`):

```svelte
<script lang="ts">
  let { data } = $props();      // { tasks, pipelines, lastProcessor, failures }
  const visibleTasks = $derived(/* uses data.tasks */);
</script>
```

`load()` can take `{ params, fetch, url, setHeaders, ... }`. Dynamic-route loads
read `params` — e.g. the KB detail page
(`marketing/kb/[id]/+page.server.ts`):

```ts
import { error } from "@sveltejs/kit";

export async function load({ params }) {
  const entry = await getKBEntry(params.id);          // [id] from the URL
  if (!entry) throw error(404, `KB entry not found: ${params.id}`);
  const bodyHtml = DOMPurify.sanitize(await marked.parse(entry.body ?? ""));
  return { entry, bodyHtml };
}
```

> **Server-only by design.** Because these are `+page.**server**.ts`, the code
> (and any secrets/fs access) never ships to the browser. The browser only
> receives the returned `data`. That's why this repo can import
> `core/lib/*` (Node-only modules that read disk and spawn `claude`) straight
> into loads.

---

## `+server.ts` — API endpoints

A `+server.ts` exports HTTP-method functions. Each returns a `Response` —
use the `json()` and `error()` helpers from `@sveltejs/kit`.

Simplest possible endpoint — `POST /api/cron` runs the processor and returns its
result (`api/cron/+server.ts`):

```ts
import { json } from "@sveltejs/kit";
import { runProcessor } from "../../../../../core/lib/processor.ts";

export async function POST() {
  const result = await runProcessor();
  return json(result);
}
```

With a dynamic param and error handling — `POST /api/tasks/:id/approve`
(`api/tasks/[id]/approve/+server.ts`):

```ts
import { json, error } from "@sveltejs/kit";
import { approveTask } from "../../../../../../../core/lib/processor.ts";

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

Notes:

- `json(value)` → a `200` JSON response. `json(value, { status })` to override.
- `error(status, message)` **throws** a typed HTTP error SvelteKit turns into
  the right status. Note `throw error(404, ...)` here is mapped to a thrown
  exception; the surrounding `try/catch` re-classifies a specific message to
  `409` and re-throws everything else.
- Read a JSON body with `await request.json()` (the POST handlers that take a
  body destructure `{ request }`).

---

## This repo uses **NO form actions** — mutations are `fetch` to `+server.ts`

SvelteKit supports `+page.server.ts` **form actions** (`export const actions`),
but this codebase deliberately doesn't use them. Every mutation is a client-side
`fetch()` to a `+server.ts` endpoint, followed by `invalidateAll()`
(`tasks/+page.svelte:32`):

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  async function approve(id: string) {
    await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
    await invalidateAll();
  }
  async function clearFailed(pipelineId?: string) {
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId }),
    });
    await invalidateAll();
  }
</script>
```

The consequence: there's a clean separation — `load()` reads, `+server.ts`
endpoints write, and the UI is a thin caller. No client-held source of truth.
See [svelte-best-practices.md](./svelte-best-practices.md) pattern #5.

---

## `invalidateAll()` — refreshing after a mutation

`invalidateAll()` from `$app/navigation` re-runs **every active `load()`** and
re-renders with the fresh server data.
([docs: `$app/navigation`](https://svelte.dev/docs/kit/$app-navigation))

It's used two ways here:

1. **After a mutation** — pull the server's actual new state (above).
2. **On a timer** — the tasks page polls every 3 s
   (`tasks/+page.svelte:8`):

```svelte
$effect(() => {
  const id = setInterval(() => invalidateAll(), 3000);
  return () => clearInterval(id);
});
```

(For finer control, `invalidate(url)` re-runs only loads that depend on a
specific dependency — but this repo's pattern is the blunt, always-correct
`invalidateAll()`.)

---

## adapter-node, scripts, and config

### adapter-node

`svelte.config.js` uses **`@sveltejs/adapter-node`**, which builds a
**standalone Node server** (a `build/` directory you run with `node build`)
rather than a serverless bundle.
([docs: adapter-node](https://svelte.dev/docs/kit/adapter-node))

```js
// dashboard/svelte.config.js
import adapter from '@sveltejs/adapter-node';

const config = {
  compilerOptions: {
    // force runes mode for everything outside node_modules
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  },
  kit: {
    adapter: adapter(),
    alias: {
      '$core': '../core/lib',
      '$core/*': '../core/lib/*',
      '$pipelines': '../pipelines',
      '$pipelines/*': '../pipelines/*'
    }
  }
};

export default config;
```

Two things to know:

- **Runes are forced on** project-wide via `compilerOptions.runes`. You don't
  opt in per-file.
- **Aliases** `$core` and `$pipelines` point up out of `dashboard/` at the repo's
  shared `core/lib` and `pipelines` directories. (Many existing files still use
  deep relative `../../../../core/lib/...` imports — both resolve to the same
  modules; the aliases are the cleaner option going forward.) `$lib` is the
  built-in SvelteKit alias for `dashboard/src/lib`.

### npm scripts

The dashboard's `package.json` runs on **port 3001**:

```jsonc
"scripts": {
  "dev":     "vite dev --port 3001",
  "build":   "vite build",
  "preview": "vite preview --port 3001",
  "check":   "...svelte-kit sync && svelte-check..."
}
```

From the repo root (`package.json`) the same commands are proxied:

```bash
npm run dev     # cd dashboard && npm run dev   → http://localhost:3001
npm run build   # production build (adapter-node output in build/)
npm run check   # type-check Svelte + TS (run this before committing)
```

`npm run check` runs `svelte-check`, which type-checks both `.svelte` and `.ts`
under the dashboard against the strict tsconfig — the closest thing this repo has
to CI. Run it before you commit.

---

## Quick reference

| Concept | This repo |
|---|---|
| Route file | `+page.svelte`, `+page.server.ts`, `+server.ts`, `+layout.svelte` |
| Dynamic segment | `[id]`, `[pillar]`, `[note]`, `[task]` → `params.x` |
| Data fetch | `load()` in `+page.server.ts`, server-only |
| API endpoint | `+server.ts` exporting `GET`/`POST`/`PUT`/`DELETE` |
| Endpoint return | `json(v)` / `throw error(status, msg)` from `@sveltejs/kit` |
| Mutations | `fetch()` to an endpoint (no form actions) |
| Refresh | `invalidateAll()` from `$app/navigation` |
| Adapter | `@sveltejs/adapter-node` → standalone Node server |
| Port | 3001 (dev & preview) |

---

## See also

- [svelte-5-primer.md](./svelte-5-primer.md) — runes & components.
- [svelte-best-practices.md](./svelte-best-practices.md) — load/fetch/invalidate pattern.
- [../dashboard/02-routing-and-loads.md](../dashboard/02-routing-and-loads.md)
- [../dashboard/03-api-endpoints.md](../dashboard/03-api-endpoints.md)
