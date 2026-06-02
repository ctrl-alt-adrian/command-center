# Dashboard 05 — Components & Patterns

> The reusable building blocks and conventions you'll copy when extending the UI: the `Failures` component, the pure `failures.ts` / `format.ts` helpers, the drafts-editor pattern (shared near-verbatim by marketing + personal-brand), toggle switches, optimistic local mutation, the no-`confirm()` convention, the status→colour maps, and server-side Markdown sanitization.
>
> Everything here is Svelte 5 runes — see the [Svelte 5 primer](../primers/svelte-5-primer.md) and [Svelte best-practices](../primers/svelte-best-practices.md).

---

## 1. `$lib/Failures.svelte` — the only shared component

`dashboard/src/lib/Failures.svelte` is the single reusable component (imported on Overview and Tasks; the per-pipeline page can pass `pipelineId` to scope it). It demonstrates the house style for a typed, self-contained component.

### Typed `$props()` with defaults

It declares an explicit `Props` interface, then destructures with defaults (`Failures.svelte:6-26`):

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDateTime } from "$lib/format";
  import type { FailureRow } from "./failures.ts";

  interface Props {
    failures: FailureRow[];
    title?: string;
    hideWhenEmpty?: boolean;       // default true → collapse when no failures
    hidePipelineColumn?: boolean;  // hide pipeline col on pipeline-specific pages
    pipelineId?: string;           // scope the Clear button to one pipeline
  }

  let {
    failures,
    title = "Failures",
    hideWhenEmpty = true,
    hidePipelineColumn = false,
    pipelineId,
  }: Props = $props();
```

> This `interface Props` + `let { … }: Props = $props()` form is the idiomatic Svelte 5 way to type component inputs — prefer it over `export let`.

### Local `$state` + `$derived`

```svelte
let expanded = $state<Record<string, boolean>>({});   // which rows are open
function toggle(id: string) { expanded[id] = !expanded[id]; }

const terminalFailures = $derived(
  failures.filter((f) => f.status === "failed" || f.status === "cleared_stale"),
);

let clearing = $state(false);
let clearResult = $state<{ ok: boolean; message: string } | null>(null);
```

- `expanded` is a mutable record toggled per row — deep mutation of a `$state` object is reactive in runes mode, so `expanded[id] = !expanded[id]` re-renders.
- `terminalFailures` is `$derived` — only `failed`/`cleared_stale` rows are *deletable* (recovered-but-recorded failures aren't), so the Clear button counts off `terminalFailures.length`, not `failures.length`.

### The Clear-N-failed action

```svelte
async function clearFailures() {
  if (clearing) return;
  if (terminalFailures.length === 0) return;
  clearing = true;
  clearResult = null;
  try {
    const body: { status: string[]; pipelineId?: string } = { status: ["failed", "cleared_stale"] };
    if (pipelineId) body.pipelineId = pipelineId;
    const res = await fetch("/api/tasks/clear", { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { clearResult = { ok: false, message: `clear failed: ${res.status}` }; return; }
    const json = (await res.json()) as { removed: number };
    clearResult = { ok: true, message: `cleared ${json.removed}` };
    await invalidateAll();
  } catch (err) {
    clearResult = { ok: false, message: (err as Error).message };
  } finally {
    clearing = false;
    setTimeout(() => (clearResult = null), 4000);
  }
}
```

The canonical mutation shape: re-entrancy guard (`if (clearing) return`), POST [`/api/tasks/clear`](./03-api-endpoints.md#post-apitasksclear), `invalidateAll()` to re-read, transient status message auto-cleared after 4 s. Each failure row is a `<button>` calling `toggle(f.taskId)` to expand an inline error panel with a deep-link to the right detail view.

---

## 2. `$lib/failures.ts` — pure transforms, zero I/O

`dashboard/src/lib/failures.ts` holds **side-effect-free** functions over `Task[]`. They're imported by `load`s (server) *and* components (client) — pure, so safe anywhere. Keep new derivations here, not inline in `load`s.

| Export | Signature | What it does |
|---|---|---|
| `extractFailures` | `(tasks: Task[]) => FailureRow[]` | Build the Failures-panel rows. Skips `completed` tasks; surfaces `failed`/`cleared_stale` **and** any task whose **latest** attempt was `error`/`gate_fail`. Sorts newest-first. |
| `countTasksByStatus` | `(tasks: Task[]) => Record<TaskStatus, number>` | Tally by status; every status pre-seeded to `0` so callers index without guards. |
| `failedCount` | `(tasks: Task[]) => number` | Count `failed` + `cleared_stale`. |
| `summarizeFailures` | `(rows: FailureRow[]) => FailureSummary` | `{ total, terminal, recovered, byPipeline }`. |

Two design notes worth knowing:

- **`extractFailures` inspects only the *most recent* attempt** (`latestAttemptFailure`) — if a task failed then later retried to success, it's no longer "failing" and is omitted as noise (`failures.ts:42-53`).
- `FailureRow` carries a `detailUrl` and `pipelineLabel` from small lookup maps (`PIPELINE_DETAIL_ROUTES`, `PIPELINE_LABELS`, `failures.ts:17-40`) so e.g. `rolenext-bug-resolver` failures deep-link to `/rolenext/bug-resolver/<id>` and render a friendly "RoleNext bug resolver" label. **When you add a pipeline with a custom detail page, add it to those maps** or it falls back to `/tasks/<id>` and the raw id.

The authoritative `TaskStatus` union lives in `core/lib/types.ts:3-11` — `pending | running | needs_review | completed | failed | paused_backpressure | paused_user | cleared_stale`. `countTasksByStatus` mirrors that list exactly; if a status is added to core, update this function or it won't compile.

---

## 3. `$lib/format.ts` — display formatters

`dashboard/src/lib/format.ts`, all pure:

- `formatDate(raw)` → `MM/DD/YYYY`, tolerating both `2026-05-13` and full ISO (slices first 10 chars).
- `formatDateTime(iso)` → `en-US` `MM/DD/YYYY, h:MM AM/PM`; returns the input unchanged if unparseable.
- `formatCron(expr)` → **decodes a 5-field cron expression to English.** Parses `min hour dom month dow` and matches a ladder of patterns: `*/5 * * * *` → "Every 5 minutes", `0 9 * * 1` → "Every Monday at 9:00 AM", `30 8 * * *` → "Daily at 8:30 AM", `0 0 1 * *` → "Monthly on day 1 at …", etc. Falls back to the raw expression on anything it can't parse (e.g. ranges/lists). Used to render pipeline schedules human-readably.

> These are the only formatters; reuse them rather than re-formatting dates inline. (Many pages also use the browser's `new Date(t.updatedAt).toLocaleTimeString()` directly for the live "updated" column — that's fine for ephemeral times, but `format.ts` is preferred for anything displayed prominently.)

---

## 4. The drafts-editor pattern (marketing + personal-brand)

`marketing/drafts/[slug]/+page.svelte` and `personal-brand/drafts/[slug]/+page.svelte` are **near-identical** — same structure, different endpoints. Learn one, you know both. Key elements:

### Platform tabs + active selection

```svelte
let selected = $state<string | null>(null);
const activePlatform = $derived(selected ?? data.set.platforms[0]?.platform ?? "");
const current = $derived(data.set.platforms.find((p) => p.platform === activePlatform));
```

Each tab is a `<button>` setting `selected = p.platform`. `activePlatform` falls back to the first platform; `current` is the active platform's draft object.

### Rendered / raw toggle (live `marked` preview)

```svelte
let view = $state<"rendered" | "raw">("rendered");   // brand editor defaults to "raw"
const html = $derived(content ? marked.parse(content) : "");
```

`rendered` shows `{@html html}` (client-side `marked.parse` of the *user's own* editable buffer — see §8 on why this is safe); `raw (editable)` shows a `<textarea bind:value={content}>`.

### The seed-guard `$effect` — the subtle, important part

The local editable buffer must seed from server data **but must not clobber unsaved edits** when the 3-second poll / `invalidateAll()` re-runs the load. The guard tracks what it last seeded from and only re-seeds when the platform or the server source actually changed:

```svelte
let content = $state("");
let dirty = $state(false);
let lastSeed = $state<{ platform: string; source: string } | null>(null);
$effect(() => {
  const platform = activePlatform;
  const source = current?.content ?? "";
  if (!lastSeed || lastSeed.platform !== platform || lastSeed.source !== source) {
    content = source;
    dirty = false;
    lastSeed = { platform, source };
  }
});
```

> **Why this matters:** a naïve `$effect(() => { content = current.content })` would overwrite the captain's in-progress edit on every poll. The `lastSeed` comparison means: re-seed only when you switch tabs or when the server's saved content genuinely changed — never just because `data` was re-fetched with the same value. Replicate this guard for any "editable buffer seeded from polled server data."

### Save (PUT, persists) vs. Refine-with-Claude (POST, does **not** persist)

```svelte
async function save() {           // → PUT /api/marketing/drafts/{slug}/{platform}
  …  body: JSON.stringify({ content })  …
  dirty = false; statusMsg = "saved"; await invalidateAll();
}

async function refine() {         // → POST .../refine  { content, instruction }
  …
  const result = (await res.json()) as { content?: string };
  if (typeof result.content === "string") {
    content = result.content;     // ← drops Claude's output into the buffer
    dirty = true;                 // ← marks dirty; NOT saved
    statusMsg = "refined — review and save";
  }
}
```

The critical distinction: **Refine returns text and only updates the textarea**; it sets `dirty = true` and the user must press **Save** to persist. The refine endpoints ([03 §7–8](./03-api-endpoints.md#post-apimarketingdraftsslugplatformrefine)) deliberately don't write to disk. The brand editor's refine differs only in that its prompt is loaded from a `refine-post.md` file; the UI is otherwise the same. The `dirty` flag also gates the Save button (`disabled={saving || !dirty}`) and renders a `● unsaved` indicator.

---

## 5. Toggle switches (`role="switch"`, `aria-checked`)

Accessible toggle switches appear on `/tasks` for two things: enabling/disabling a **pipeline** and disabling/enabling an individual **pending task**. Both follow the same ARIA + Tailwind pattern (`tasks/+page.svelte:243-252`):

```svelte
<button
  type="button"
  role="switch"
  aria-checked={p.enabled}
  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 {p.enabled ? 'bg-ok' : 'bg-muted/40'}"
  onclick={() => togglePipeline(p.id, !p.enabled)}
  title={p.enabled ? 'Disable — processor skips all tasks for this pipeline' : 'Enable — pipeline resumes processing'}
>
  <span class="inline-block h-3 w-3 transform rounded-full bg-background transition-transform {p.enabled ? 'translate-x-5' : 'translate-x-1'}"></span>
</button>
```

- `role="switch"` + `aria-checked` makes it a real switch for assistive tech.
- The knob slides via `translate-x-5` / `translate-x-1`; the track colours via `bg-ok` / `bg-muted/40`.
- `togglePipeline` POSTs [`/api/pipelines/[id]/enabled`](./03-api-endpoints.md#6--pipelines--apipipelinesidenabled); the per-task toggle reuses `disable`/`enable` (which the engine implements via `paused_user`). Always pair a switch with a `title` explaining the consequence.

---

## 6. Optimistic local mutation (vault staging) {#optimistic-local-mutation}

`vault/staging/[task]/+page.svelte` is the **one** place the UI updates local state *before/without* re-reading from the server. It seeds a `$state` array from `data` and mutates it in place on each decision:

```svelte
// svelte-ignore state_referenced_locally
let candidates = $state(data.candidates);

async function setStatus(file: string, status: "approved" | "rejected") {
  …
  const res = await fetch(`/api/vault/staging/${data.taskId}/${encodeURIComponent(file)}`, { … });
  if (res.ok) {
    candidates = candidates.map((c) => (c.file === file ? { ...c, status } : c));   // optimistic-ish
  }
}
```

It still POSTs the real decision to [`/api/vault/staging/[task]/[file]`](./03-api-endpoints.md#post-apivaultstagingtaskfile); it just reflects the result by reassigning the local array on success rather than calling `invalidateAll()`. The `counts` summary (`approved`/`rejected`/`pending`) is `$derived` from `candidates`, so it updates instantly. The `// svelte-ignore state_referenced_locally` comment silences the compiler warning about seeding `$state` from a prop — intentional here because this page owns the working copy. The final **"Embed approved"** button (`finalize`) approves the task **and then POSTs `/api/cron`** to run the embed phase immediately ([04 §B](./04-full-stack-trace.md#part-b--the-heartbeat-os-cron--one-tick)).

---

## 7. No `confirm()` dialogs — a deliberate convention {#no-confirm-dialogs}

> **There are no `confirm()` / native confirmation dialogs anywhere in the dashboard.** Clicking the button **is** the confirmation. This applies to destructive actions too — `remove`/`delete task`, `clear failed`, `clear failures`, `reject`. This is an intentional project rule, not an oversight: the captain operates this tool rapidly and dialogs would be friction.

When you add a new action button, **do not** add a `confirm()` guard. If an action needs care, encode it in the data flow instead (the allowlist on `/api/tasks/clear`, the 409 gate-block on approve, the `disabled` states) — not a modal. Re-entrancy guards (`if (saving) return`) and `disabled` flags are the accepted safety mechanisms.

---

## 8. Status → colour maps & Markdown sanitization

### Status → Tailwind colour maps {#status-color-maps}

A `STATUS_COLORS: Record<string, string>` map appears **duplicated per page** (Tasks, Task detail, `Failures.svelte`), e.g.:

```ts
const STATUS_COLORS: Record<string, string> = {
  pending: "text-foreground", running: "text-accent", needs_review: "text-warn",
  paused_backpressure: "text-danger", paused_user: "text-warn", completed: "text-muted",
  failed: "text-danger", cleared_stale: "text-muted",
};
```

It maps each status to one of the semantic theme colours from [01 §5](./01-stack-and-bootstrap.md#tailwind-v4-theme-inline--the-colour-system) (`text-warn`, `text-danger`, `text-ok`, etc.). It's copy-pasted rather than centralized — keep that in mind when statuses change. The **authoritative status list is `core/lib/types.ts`** (`TaskStatus`); the colour maps are display-only and don't need every status (an unmapped status renders with no colour class via `?? ''`).

### Server-side Markdown sanitization {#server-side-markdown-sanitization}

Anywhere **AI- or user-authored Markdown is rendered as HTML, it is sanitized on the server** with `marked` → `DOMPurify.sanitize` before reaching `{@html}` — in `marketing/kb/[id]`, `rolenext/bug-resolver`, and `rolenext/bug-resolver/[taskId]` loads ([02 §3](./02-routing-and-loads.md#3--server-side-markdown-rendering-marked--isomorphic-dompurify)). The drafts editors render Markdown **client-side** with `marked.parse` for live preview — that's acceptable because the content is the captain's own editable buffer (never another user's input, never persisted as HTML; only the raw Markdown is saved via the PUT endpoints). **Rule of thumb:** untrusted/AI Markdown → sanitize server-side; your own live-preview buffer → client `marked.parse` is fine.

The drafts editors also scope their rendered Markdown styling with a `.draft-rendered :global(...)` block (`marketing/drafts/[slug]/+page.svelte:193-210`) so `{@html}` output gets proper heading/list/code styling without leaking global CSS.

---

## 9. Pattern checklist for new UI

When you add a page or action, match these:

1. **Read in `+page.server.ts`** with `Promise.all` + `.catch(() => default)`; return a plain `data` object. ([02](./02-routing-and-loads.md))
2. **Render with `$props()` + `$derived`**; never duplicate `data` into `$state` (except an owned working copy like vault staging).
3. **Poll with `$effect` + `setInterval(invalidateAll, ms)`** and **return the `clearInterval` cleanup**.
4. **Mutate via `fetch()` to a `/api/*` endpoint**, then `invalidateAll()` (or `location.reload()` on detail pages). No form actions.
5. **No `confirm()`.** Guard re-entrancy with a `$state` boolean + `disabled`.
6. **Use theme colours** (`bg-card`, `text-warn`, `border-danger`, …) — no hardcoded hex.
7. **Sanitize untrusted Markdown server-side** before `{@html}`.
8. **Put pure derivations in `$lib/failures.ts` / `$lib/format.ts`**, not inline.

---

### Cross-links

- [Svelte 5 primer](../primers/svelte-5-primer.md) — `$state`, `$derived`, `$props`, `$effect`.
- [Svelte best-practices](../primers/svelte-best-practices.md) — typed props, effect cleanup, `{@html}` safety.
- [03 — API endpoints](./03-api-endpoints.md) — the endpoints these components call.
- [04 — Full-stack trace](./04-full-stack-trace.md) — how a button reaches the engine and back.
- [`../core/05-task-store.md`](../core/05-task-store.md) — `Task` shape behind `FailureRow` / `STATUS_COLORS`.
