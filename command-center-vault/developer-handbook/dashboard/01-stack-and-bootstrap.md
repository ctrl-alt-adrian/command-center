# Dashboard 01 — Stack & Bootstrap

> The dashboard is a **pure web SvelteKit app**. There is **no Tauri, no Rust, no `src-tauri/`** — verified: `dashboard/src-tauri` does not exist. It is a thin browser shell over the file-based engine in [`../core/`](../core/01-data-model.md). Every page reads the engine; every button POSTs an API route that calls the engine. The dashboard itself holds **no persistent state**.

This page covers the toolchain, the build/config files, the path aliases, the dark theme wiring, and — most importantly — the **server-startup bootstrap** that makes pipelines visible to the app.

---

## 1. The stack

| Concern | Choice | Version | Where it's pinned |
|---|---|---|---|
| Framework | SvelteKit | `^2.57.0` | `dashboard/package.json:16` |
| Component language | Svelte 5 (**runes mode**) | `^5.55.2` | `dashboard/package.json:20` |
| Build tool | Vite | `^8.0.7` | `dashboard/package.json:24` |
| Svelte/Vite glue | `@sveltejs/vite-plugin-svelte` | `^7.0.0` | `dashboard/package.json:17` |
| Adapter | `@sveltejs/adapter-node` | `^5.5.4` | `dashboard/package.json:15` |
| CSS | Tailwind v4 via `@tailwindcss/vite` | `^4.2.2` | `dashboard/package.json:18,22` |
| Types | TypeScript | `^6.0.2` | `dashboard/package.json:23` |
| Node types | `@types/node` | `^25.5.2` | `dashboard/package.json:19` |
| Runtime dep — Markdown | `marked` | `^18.0.3` | `dashboard/package.json:30` |
| Runtime dep — HTML sanitize | `isomorphic-dompurify` | `^3.13.0` | `dashboard/package.json:28` |
| Runtime dep — YAML | `js-yaml` (+ `@types/js-yaml`) | `^4.1.1` | `dashboard/package.json:27,29` |

Everything except the four runtime `dependencies` (`marked`, `isomorphic-dompurify`, `js-yaml`, `@types/js-yaml`) is a `devDependency` — they're build-time only because SvelteKit bundles them. The four runtime deps are used **server-side** to render and sanitize Markdown (`marked` + `isomorphic-dompurify`) and to read YAML frontmatter (`js-yaml`, used transitively through the core vault reader).

> Official docs: [SvelteKit introduction](https://svelte.dev/docs/kit/introduction) · [Svelte 5 `$state`](https://svelte.dev/docs/svelte/$state) · [Tailwind v4](https://tailwindcss.com/docs).

### Scripts & port

`dashboard/package.json:6-13`:

```json
"scripts": {
  "dev": "vite dev --port 3001",
  "build": "vite build",
  "preview": "vite preview --port 3001",
  "prepare": "svelte-kit sync || echo ''",
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
}
```

The app runs on **port 3001** — both in dev (`--port 3001`) and via the Vite server config below. The OS cron that drives the engine hits `http://localhost:3001/api/cron` (see [04 — Full-stack trace](./04-full-stack-trace.md)).

---

## 2. Vite config

`dashboard/vite.config.ts` is tiny — two plugins and the port:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { port: 3001 }
});
```

Note the order: `tailwindcss()` runs before `sveltekit()`. Tailwind v4 is a **Vite plugin** here, not a PostCSS step — there is **no `tailwind.config.js` and no `postcss.config.js`** in the project. Tailwind v4 is "CSS-first": configuration lives in CSS via the `@theme` directive (see §5).

---

## 3. SvelteKit config & path aliases

`dashboard/svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
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

Three things to internalize:

1. **Runes are forced on** for all first-party files. The `compilerOptions.runes` predicate returns `true` for anything outside `node_modules` and `undefined` (= leave to per-file detection) inside it. So every `.svelte` file in this app is in runes mode — `$state`, `$derived`, `$props`, `$effect`. See the [Svelte 5 primer](../primers/svelte-5-primer.md).

2. **adapter-node.** `adapter()` with no options produces a standalone Node server (`build/index.js` after `vite build`). This is why server code can freely `import fs from "node:fs"` and reach the filesystem — there's a real Node process behind every request.

3. **Path aliases `$core` and `$pipelines` exist but are barely used.** They point up out of the dashboard into the sibling `core/lib` and `pipelines` directories. **In practice the codebase almost always uses long relative imports instead** — e.g. `tasks/+page.server.ts:1` imports `"../../../../core/lib/tasks.ts"`, not `"$core/tasks.ts"`. The reason: the `.ts` extension is preserved (TypeScript `rewriteRelativeImportExtensions`, see §4) and the relative form was the established pattern. Don't be surprised that the aliases are configured but rarely seen.

> **`$lib` IS used everywhere**, though. `$lib` is SvelteKit's built-in alias for `dashboard/src/lib/` (not configured in `svelte.config.js` — it's a framework default). You'll see `import Failures from "$lib/Failures.svelte"` and `import { extractFailures } from "$lib/failures"` throughout. See [05 — Components & patterns](./05-components-and-patterns.md).

---

## 4. TypeScript config

`dashboard/tsconfig.json` extends the generated `.svelte-kit/tsconfig.json` and turns on strict, bundler-resolution settings:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "rewriteRelativeImportExtensions": true,
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

The load-bearing flag is **`rewriteRelativeImportExtensions: true`** — this is what makes `import { listTasks } from "../../../../core/lib/tasks.ts"` (with the explicit `.ts`) legal. The core engine modules are authored with `.ts` import specifiers, and the dashboard imports them verbatim; the compiler rewrites `.ts` → `.js` at emit. `checkJs: true` type-checks the JS config files too.

`dashboard/src/app.d.ts` is the standard SvelteKit ambient-types stub — all of `App.Error`, `App.Locals`, `App.PageData`, `App.PageState`, `App.Platform` are left commented out (no custom `locals`, no custom error shape).

---

## 5. App shell & dark theme (`app.html` + `app.css`)

`dashboard/src/app.html` is the minimal SvelteKit template:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Command Center</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

`data-sveltekit-preload-data="hover"` turns on link preloading on hover app-wide — hovering a nav link starts the target route's `load` early.

### Tailwind v4 `@theme inline` — the colour system

`dashboard/src/app.css` is the entire stylesheet. It (a) imports Tailwind, (b) declares CSS custom properties for a dark palette on `:root`, and (c) maps those vars into Tailwind's colour space with **`@theme inline`** so they become first-class utility colours:

```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --sidebar: #18181b;
  --card: #27272a;
  --border: #3f3f46;
  --muted: #a1a1aa;
  --accent: #60a5fa;
  --warn: #fbbf24;
  --danger: #f87171;
  --ok: #4ade80;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-sidebar: var(--sidebar);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-warn: var(--warn);
  --color-danger: var(--danger);
  --color-ok: var(--ok);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

**Why this matters when you write UI:** because each `--color-<name>` is registered in `@theme`, Tailwind generates the full family of utilities for it. That's why you can write `bg-card`, `text-warn`, `border-danger`, `text-muted`, `bg-accent`, `text-ok`, `bg-sidebar`, `text-foreground`, etc., and they Just Work — and **opacity modifiers compose too**: `bg-warn/10`, `border-danger/40`, `text-muted/60`, `bg-ok/20` all appear in the codebase. There is no config file to edit; to add a colour you add a `--color-*` line here. The `inline` keyword means Tailwind emits the `var(--…)` reference directly rather than resolving it at build time, so the `:root` values remain the single source of truth (and could be themed at runtime).

The dark palette in plain terms: near-black `--background`, near-white `--foreground`, a three-step grey ramp `sidebar → card → border`, muted grey text, and four semantic accents — blue `accent`, amber `warn`, red `danger`, green `ok`. These map directly onto the status colours used across the task UI (see [05 — Components & patterns](./05-components-and-patterns.md#status-color-maps)).

---

## 6. Server bootstrap — `hooks.server.ts` (the critical bit)

This is the single most important file for understanding *how the dashboard knows about pipelines at all*. `dashboard/src/hooks.server.ts` runs **once, at module-evaluation time** when the SvelteKit server boots — not per request:

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapPipelines } from "../../core/lib/registry-bootstrap.ts";

loadRootDotenv();
bootstrapPipelines();

export async function handle({ event, resolve }) {
  return resolve(event);
}
```

Two side effects fire at startup, then `handle` is a **pure pass-through** — no auth, no logging, no header munging. (`App.Locals` is empty in `app.d.ts` for exactly this reason: nothing is attached to the request.)

### `bootstrapPipelines()` — how pipelines become visible

`bootstrapPipelines()` lives in `core/lib/registry-bootstrap.ts` and `registerPipeline()`s **all 9 pipelines** into the in-memory registry. Verified import + register list (`core/lib/registry-bootstrap.ts:5-23`):

| # | Registered pipeline export | Pipeline id |
|---|---|---|
| 1 | `marketingPipeline` | `marketing` |
| 2 | `vaultNuggetsPipeline` | `vault-nuggets` |
| 3 | `competitorsPipeline` | `competitors` |
| 4 | `redditPmfPipeline` | `reddit-pmf` |
| 5 | `redditPmfMetricsPipeline` | `reddit-pmf-metrics` |
| 6 | `softwareFactoryHousekeepingPipeline` | `software-factory-housekeeping` |
| 7 | `rolenextBugResolverPipeline` | `rolenext-bug-resolver` |
| 8 | `rolenextJobApplyPipeline` | `rolenext-job-apply` |
| 9 | `personalBrandPipeline` | `personal-brand` |

> **This is the contract for adding a new pipeline.** A pipeline is invisible to the dashboard until it's registered here. The registry is process-local in-memory state; because `hooks.server.ts` is evaluated on boot, every server worker has the full registry before it handles its first request. Server-only modules like `core/lib/registry.ts`'s `getPipeline()` and `core/lib/processor.ts`'s `pipelineStatus()` then return populated data. See [`../core/07-registry-bootstrap.md`](../core/07-registry-bootstrap.md) for the registry internals.

### `loadRootDotenv()` — repo-root `.env` is canonical

SvelteKit/Vite do **not** auto-populate `process.env` from the repo-root `.env` for server runtime (their `$env` handling is build-scoped). So `hooks.server.ts` hand-parses `../../.env` (relative to the compiled hook, i.e. the **repo root**, not `dashboard/`) on startup:

```ts
function loadRootDotenv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(here, "../../.env");
  let raw: string;
  try {
    raw = fs.readFileSync(envPath, "utf-8");
  } catch {
    return;                       // no .env? fine, just skip
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;   // shell vars WIN
    let value = trimmed.slice(eq + 1).trim();
    // strip matching single/double quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
```

Precedence rule worth remembering: **shell-exported variables win over the file.** The line `if (process.env[key] !== undefined) continue;` means an already-set env var is never overwritten by the `.env` file. So to override config for a single run, `export FOO=bar` before launching — don't edit `.env`. Comments (`#…`) and blank lines are skipped; quoted values are unquoted. This is the same env that downstream code reads — e.g. `rolenext/+page.server.ts` reads `process.env.ROLENEXT_JWT` / `process.env.ROLENEXT_API_BASE`.

---

## 7. Mental model

```
                         ┌──────────────────────────────────────┐
  vite dev --port 3001   │  SvelteKit (adapter-node) process     │
  ───────────────────────►  ┌────────────────────────────────┐   │
                         │  │ hooks.server.ts (once, on boot)│   │
                         │  │   loadRootDotenv()  → process.env │
                         │  │   bootstrapPipelines() → registry │
                         │  └────────────────────────────────┘   │
                         │            │ registry + env now live   │
                         │            ▼                           │
   browser ── HTTP ───►  │  +page.server.ts loads  &  /api/* POSTs│
                         │            │                           │
                         │            ▼  direct function calls     │
                         │     core/lib/*  +  pipelines/*  (fs)    │
                         └──────────────────────────────────────┘
                                      │  reads/writes
                                      ▼
                          task.json files, vault/, signals/, logs/ …
```

The dashboard process **is** the engine host. There's no separate backend service — `core/lib` and `pipelines/*` are imported straight into SvelteKit's server runtime.

---

### Cross-links

- [`../core/07-registry-bootstrap.md`](../core/07-registry-bootstrap.md) — what `registerPipeline()` / `getPipeline()` do.
- [02 — Routing & loads](./02-routing-and-loads.md) — how `load` functions reach the engine.
- [03 — API endpoints](./03-api-endpoints.md) — the mutation surface.
- [04 — Full-stack trace](./04-full-stack-trace.md) — end-to-end request walk-through.
- [Svelte 5 primer](../primers/svelte-5-primer.md) · [SvelteKit primer](../primers/sveltekit-primer.md).
