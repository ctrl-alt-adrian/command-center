# Svelte 5 (Runes) Primer

This is a from-scratch primer on **Svelte 5 with runes** — the reactivity model
this codebase uses everywhere. If you've written Svelte 4 (`export let`, `$:`,
stores), the most important sections below are **[Coming from Svelte 4](#coming-from-svelte-4)**
and **[Events](#event-handlers)**, because the syntax changed.

Every example here is either canonical Svelte or a **real excerpt from this
repo**. Official docs are linked inline — read them; this primer is the map, not
the territory.

> Companion pages: [svelte-best-practices.md](./svelte-best-practices.md) for
> good-vs-bad patterns, [sveltekit-primer.md](./sveltekit-primer.md) for routing
> and `load()`, and
> [../dashboard/05-components-and-patterns.md](../dashboard/05-components-and-patterns.md)
> for this project's component conventions.

---

## A component is one file

A `.svelte` file is three optional parts in any order:

```svelte
<script lang="ts">
  // logic — runs once per component instance
</script>

<!-- markup — HTML + Svelte template syntax -->

<style>
  /* scoped to this component by default */
</style>
```

`lang="ts"` turns on TypeScript in the script block — this repo always uses it.
The real `+layout.svelte` is about as small as a component gets
(`dashboard/src/routes/+layout.svelte`):

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="h-screen flex overflow-hidden">
  <aside><!-- nav --></aside>
  <main>{@render children()}</main>
</div>
```

---

## `$state` — reactive local state

`$state(...)` declares a reactive variable. Reassign it with `=` and the UI
updates. ([docs: `$state`](https://svelte.dev/docs/svelte/$state))

```svelte
<script lang="ts">
  let count = $state(0);
</script>
<button onclick={() => count++}>clicked {count} times</button>
```

`$state` is **deeply reactive** for plain objects and arrays — mutating a nested
property (`obj.foo = 1`, `arr.push(x)`) triggers updates because Svelte wraps
them in proxies. (Caveat: `Set`/`Map`/class instances are *not* deeply proxied
the same way — see the best-practices page on reassigning a `new Set(...)`.)

Real uses from `tasks/+page.svelte` — a typed filter and a `Record` of toggles:

```svelte
<script lang="ts">
  let filter = $state<"all" | "pending" | "needs_review" | "failed"
    | "completed" | "paused_backpressure" | "paused_user">("all");
</script>
```

```svelte
<!-- Failures.svelte: a record used as an expand/collapse map -->
<script lang="ts">
  let expanded = $state<Record<string, boolean>>({});
  function toggle(id: string) {
    expanded[id] = !expanded[id]; // mutating a $state object IS reactive
  }
</script>
```

Note `$state<T>(...)` takes a type argument — handy when the initial value
doesn't pin the type you want.

---

## `$derived` and `$derived.by` — computed values

`$derived(expr)` is a value computed from other reactive state. It re-runs
automatically when its dependencies change and is read like a plain variable
(no `()`). ([docs: `$derived`](https://svelte.dev/docs/svelte/$derived))

Real example, the filtered task list (`tasks/+page.svelte:24`):

```svelte
<script lang="ts">
  let { data } = $props();
  let filter = $state<...>("all");

  const visibleTasks = $derived(
    filter === "all" ? data.tasks : data.tasks.filter((t) => t.status === filter),
  );
</script>

{#each visibleTasks as t}
  <!-- ... -->
{/each}
```

When the expression needs a multi-statement body (a loop, a `Map`, branching),
use **`$derived.by(() => { ... })`** — same semantics, function form. Real
example from the same file (`tasks/+page.svelte:98`):

```svelte
<script lang="ts">
  // Set of "pipelineId:phaseId" for deterministic gates.
  const deterministicPhases = $derived.by(() => {
    const s = new Set<string>();
    for (const p of data.pipelines) {
      for (const ph of p.phases) {
        if (ph.gateType === "deterministic") s.add(`${p.id}:${ph.id}`);
      }
    }
    return s;
  });
</script>
```

> **Rule of thumb:** if a value can be *computed* from other state, make it
> `$derived`. Don't keep a second `$state` in sync by hand — that's the
> number-one anti-pattern (see [best-practices](./svelte-best-practices.md)).

---

## `$props` — component inputs

`$props()` returns this component's inputs. Destructure them, give defaults, and
type them with an interface. ([docs: `$props`](https://svelte.dev/docs/svelte/$props))

The simplest form (just grab `data`, which SvelteKit's `load()` provides):

```svelte
<!-- tasks/+page.svelte:5 -->
<script lang="ts">
  let { data } = $props();
</script>
```

The full, typed form — a real component with a `Props` interface, optional
fields, and defaults (`Failures.svelte:6`):

```svelte
<script lang="ts">
  import type { FailureRow } from "./failures.ts";

  interface Props {
    failures: FailureRow[];
    title?: string;
    hideWhenEmpty?: boolean;     // collapse when no failures
    hidePipelineColumn?: boolean;
    pipelineId?: string;         // scope the Clear button to one pipeline
  }

  let {
    failures,
    title = "Failures",          // ← default
    hideWhenEmpty = true,        // ← default
    hidePipelineColumn = false,
    pipelineId,
  }: Props = $props();
</script>
```

The parent passes props as attributes, e.g. from `tasks/+page.svelte:210`:

```svelte
<Failures failures={data.failures} title="Failures across all pipelines" />
```

---

## `$effect` — side effects (and cleanup)

`$effect(() => { ... })` runs a side effect *after* the DOM updates, and re-runs
when any reactive value it reads changes. Return a function to **clean up**
before the next run and on unmount. ([docs: `$effect`](https://svelte.dev/docs/svelte/$effect))

The canonical use here is polling — the tasks page re-fetches its `load` data
every 3 s and tears the interval down on unmount (`tasks/+page.svelte:8`):

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 3000);
    return () => clearInterval(id); // ← cleanup: stop the interval
  });
</script>
```

Without that returned cleanup, every navigation would leak a fresh
`setInterval`. The cleanup function is mandatory hygiene for intervals,
subscriptions, and listeners — see the best-practices page for the leaking-vs-
cleaned comparison.

A second real pattern: **seeding editable state from props** without clobbering
edits. From the drafts editor (`marketing/drafts/[slug]/+page.svelte:19`):

```svelte
<script lang="ts">
  let content = $state("");
  let dirty = $state(false);
  let lastSeed = $state<{ platform: string; source: string } | null>(null);

  $effect(() => {
    const platform = activePlatform;
    const source = current?.content ?? "";
    // Only re-seed when the platform or server source actually changed —
    // otherwise we'd overwrite the captain's in-progress edits on every tick.
    if (!lastSeed || lastSeed.platform !== platform || lastSeed.source !== source) {
      content = source;
      dirty = false;
      lastSeed = { platform, source };
    }
  });
</script>
```

> **`$effect` is for side effects, not derivation.** If you find yourself
> setting one `$state` from another inside an effect, you almost certainly want
> `$derived` instead.

---

## Coming from Svelte 4

If your Svelte muscle memory is v4, here's the translation table. The runes
replace the old magic syntax.

| Svelte 4 | Svelte 5 (this repo) |
|---|---|
| `export let foo;` | `let { foo } = $props();` |
| `let count = 0;` (reactive by being top-level) | `let count = $state(0);` |
| `$: doubled = count * 2;` | `const doubled = $derived(count * 2);` |
| `$: { sideEffect(); }` | `$effect(() => { sideEffect(); });` |
| writable store + `$store` everywhere | plain `$state` (stores are no longer the default) |
| `<button on:click={fn}>` | `<button onclick={fn}>` |
| `<slot />` / `<slot name="x" />` | `{@render children()}` snippets |

Key points:

- **No more `export let`.** Inputs come from `$props()`.
- **No more `$:`.** Computed values are `$derived`; effects are `$effect`. The
  old `$:` conflated the two and was a frequent footgun.
- **Stores are not the default.** You *can* still use `$store` syntax for a
  Svelte store, but day-to-day reactive state is `$state`. This repo holds
  almost no client-side store state — the source of truth is the server, pulled
  via `load()` and refreshed with `invalidateAll()`.

---

## Event handlers

Svelte 5 uses **plain DOM-style attributes**: `onclick`, `oninput`,
`onkeydown` — not the old `on:click` directive.

```svelte
<!-- tasks/+page.svelte -->
<button class="..." onclick={() => approveAll()}>approve all</button>
<button class="..." onclick={() => (filter = f as typeof filter)}>{f}</button>
```

```svelte
<!-- drafts editor: keydown handler that fires on Enter -->
<input
  bind:value={refineInput}
  onkeydown={(e) => { if (e.key === "Enter") refine(); }}
/>
```

The handler is just a function reference or an inline arrow. Event objects are
typed (`e: KeyboardEvent`, etc.) when you're in a `lang="ts"` block.

---

## `bind:value` — two-way binding

`bind:value` keeps a form control and a `$state` variable in sync both ways.
From the drafts editor (`marketing/drafts/[slug]/+page.svelte`):

```svelte
<script lang="ts">
  let content = $state("");
  let refineInput = $state("");
</script>

<textarea bind:value={content} oninput={() => (dirty = true)}></textarea>

<input type="text" bind:value={refineInput} placeholder="..." />
```

Editing the textarea updates `content`; setting `content` in code updates the
textarea. Here `oninput` *also* flags `dirty` — `bind:` and a manual handler
coexist fine.

---

## Template control flow

### `{#if}` / `{:else if}` / `{:else}`

```svelte
<!-- Failures.svelte -->
{#if failures.length === 0}
  {#if !hideWhenEmpty}
    <section>No failures recorded. ✓</section>
  {/if}
{:else}
  <section><!-- the failures table --></section>
{/if}
```

### `{#each}` (with `{:else}` for empty)

```svelte
<!-- tasks/+page.svelte -->
{#each visibleTasks as t}
  <tr onclick={...}>
    <td>{t.id.slice(0, 8)}</td>
    <td>{t.status}</td>
  </tr>
{/each}
```

`{#each ... as item, index}` gives the index; `{#each ... as item (item.id)}`
adds a keyed block (stable identity across reorders). Use `{:else}` for the
empty case:

```svelte
{#each items as item}
  <li>{item}</li>
{:else}
  <li>nothing here</li>
{/each}
```

(This repo often handles "empty" with a separate `{#if visibleTasks.length === 0}`
block right after the `{#each}`, which is equivalent — see
`tasks/+page.svelte:410`.)

---

## `{@render children()}` — snippets (the new slots)

Snippets replace Svelte 4 slots. A layout receives a `children` snippet and
renders it with `{@render children()}`. Real `+layout.svelte`:

```svelte
<script lang="ts">
  let { children } = $props();
</script>

<main>{@render children()}</main>
```

You can declare your own named snippets with `{#snippet name(args)}...{/snippet}`
and render them with `{@render name(args)}`, but in this repo the dominant use is
the implicit `children` snippet from SvelteKit layouts.

---

## `{@html ...}` — raw HTML

`{@html string}` injects a string as HTML, bypassing escaping. The drafts editor
uses it to render markdown that was parsed to HTML
(`marketing/drafts/[slug]/+page.svelte:144`):

```svelte
<script lang="ts">
  import { marked } from "marked";
  let content = $state("");
  const html = $derived(content ? marked.parse(content) : "");
</script>

<article class="draft-rendered">{@html html}</article>
```

> **Security:** `{@html}` does **not** sanitize. The draft content here is the
> captain's own, so it's trusted. For any *untrusted* markdown the rule in this
> repo is to sanitize **server-side** with `marked` + `isomorphic-dompurify`
> before it ever reaches the page (see `marketing/kb/[id]/+page.server.ts` and
> the best-practices page). Never `{@html}` raw user input.

---

## `{@const ...}` — a local constant inside a block

`{@const}` binds a value inside `{#each}`/`{#if}`/`{#snippet}` blocks — useful to
avoid recomputing or to name a lookup. Real use in the in-flight breakdown
(`tasks/+page.svelte:282`):

```svelte
{#each p.phases as ph}
  {@const slot = inFlightByPipelinePhase[p.id]?.[ph.id]}
  {#if slot && (slot.running > 0 || slot.pending > 0)}
    <span>{ph.id}: {slot.running} running · {slot.pending} pending</span>
  {/if}
{/each}
```

And in the per-task enabled toggle (`tasks/+page.svelte:373`):

```svelte
{#if t.status === "pending" || t.status === "paused_backpressure" || t.status === "paused_user"}
  {@const enabled = t.status !== "paused_user"}
  <button onclick={() => (enabled ? disable(t.id) : enable(t.id))}>...</button>
{/if}
```

---

## Quick reference

| Rune / syntax | Purpose | Docs |
|---|---|---|
| `$state(v)` | reactive variable | [link](https://svelte.dev/docs/svelte/$state) |
| `$derived(expr)` / `$derived.by(fn)` | computed value | [link](https://svelte.dev/docs/svelte/$derived) |
| `$props()` | component inputs | [link](https://svelte.dev/docs/svelte/$props) |
| `$effect(fn)` | side effect + cleanup | [link](https://svelte.dev/docs/svelte/$effect) |
| `onclick={fn}` | event handler | — |
| `bind:value={x}` | two-way binding | — |
| `{#if}/{#each}/{:else}` | control flow | — |
| `{@render children()}` | render a snippet | — |
| `{@html s}` | raw HTML (sanitize first!) | — |
| `{@const x = ...}` | block-local constant | — |

---

## See also

- [svelte-best-practices.md](./svelte-best-practices.md) — good vs bad, grounded in this codebase.
- [sveltekit-primer.md](./sveltekit-primer.md) — routing, `load()`, endpoints, `invalidateAll()`.
- [../dashboard/05-components-and-patterns.md](../dashboard/05-components-and-patterns.md) — this project's component conventions.
