# Svelte 5 Best Practices (Good vs Bad)

Seven patterns, each with a **GOOD** block, a **BAD** block, and a **WHY**. All
GOOD examples are drawn from this codebase's real conventions. Read the
[svelte-5-primer.md](./svelte-5-primer.md) first for the rune basics; this page
is about *judgment*.

> See also [../dashboard/05-components-and-patterns.md](../dashboard/05-components-and-patterns.md)
> for component layout conventions and
> [../best-practices/coding.md](../best-practices/coding.md) for the
> project-wide rules these examples instantiate.

---

## 1. Derive, don't duplicate state

**GOOD** — compute from existing state with `$derived` (`tasks/+page.svelte:24`):

```svelte
<script lang="ts">
  let { data } = $props();
  let filter = $state<"all" | "pending" | "failed" | "completed">("all");

  const visibleTasks = $derived(
    filter === "all" ? data.tasks : data.tasks.filter((t) => t.status === filter),
  );
</script>
```

**BAD** — a second `$state` kept in sync by hand inside an effect:

```svelte
<script lang="ts">
  let filter = $state("all");
  let visibleTasks = $state(data.tasks); // ⛔ duplicate source of truth

  $effect(() => {
    // runs after render, one tick late, and forgets to re-run when
    // data.tasks changes unless you remember to read it here too
    visibleTasks = filter === "all" ? data.tasks : data.tasks.filter(t => t.status === filter);
  });
</script>
```

**WHY:** `$derived` recomputes synchronously and tracks *every* dependency it
reads (`filter` **and** `data.tasks`) automatically. The manual version is a
second source of truth: it lags by a tick, can drift if you forget a dependency,
and re-renders more than necessary. If a value can be computed, it should be
`$derived`, never a mirrored `$state`.

---

## 2. Always clean up intervals / subscriptions in `$effect`

**GOOD** — the real polling teardown (`tasks/+page.svelte:8`):

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 3000);
    return () => clearInterval(id); // ✅ stops on unmount / before re-run
  });
</script>
```

**BAD** — no cleanup:

```svelte
<script lang="ts">
  $effect(() => {
    setInterval(() => invalidateAll(), 3000); // ⛔ leaks
  });
</script>
```

**WHY:** the function you `return` from `$effect` runs before the effect re-runs
and on unmount. Without it, navigating away from `/tasks` leaves a `setInterval`
firing forever; bounce between pages a few times and you've got several
overlapping timers all calling `invalidateAll()`. Same rule for
`addEventListener`/`removeEventListener`, store subscriptions, `WebSocket`,
`AbortController`, etc. — set it up in the effect, tear it down in the return.

---

## 3. Seed editable `$state` from props with a guard — don't clobber edits

**GOOD** — the seed-guard pattern from the drafts editor
(`marketing/drafts/[slug]/+page.svelte:19`). Re-seed *only* when the upstream
source actually changes:

```svelte
<script lang="ts">
  let content = $state("");
  let dirty = $state(false);
  let lastSeed = $state<{ platform: string; source: string } | null>(null);

  $effect(() => {
    const platform = activePlatform;
    const source = current?.content ?? "";
    if (!lastSeed || lastSeed.platform !== platform || lastSeed.source !== source) {
      content = source;   // seed the textarea
      dirty = false;
      lastSeed = { platform, source };
    }
  });
</script>
```

When the seed value is read directly during initialization, Svelte may warn
`state_referenced_locally`; suppress it intentionally with the ignore comment:

```svelte
<script lang="ts">
  let { data } = $props();
  // svelte-ignore state_referenced_locally
  let content = $state(data.initialContent);
</script>
```

**BAD** — re-seed every effect run:

```svelte
<script lang="ts">
  let content = $state("");
  $effect(() => {
    content = current?.content ?? ""; // ⛔ overwrites the captain's typing
  });
</script>
```

**WHY:** the tasks page polls and calls `invalidateAll()` every 3 s, which
re-runs `load()` and re-creates `data`. The naive effect re-reads `current` and
stomps the textarea on every poll — the user's half-written edit vanishes mid-
keystroke. The guard compares the *new server source* against the last value it
seeded from; it only overwrites when the platform switched or the server content
genuinely changed, so in-progress edits survive background refreshes.

---

## 4. Reassign `Set`/arrays for reactivity — don't mutate in place

**GOOD** — build a new `Set` and assign it (idiom used across the codebase, e.g.
when toggling a membership set):

```svelte
<script lang="ts">
  let enabled = $state(new Set<string>());

  function toggle(id: string) {
    const next = new Set(enabled);
    next.has(id) ? next.delete(id) : next.add(id);
    enabled = next; // ✅ reassignment triggers reactivity
  }
</script>
```

For plain `$state` objects/arrays, in-place mutation *is* reactive (Svelte
proxies them) — that's why `expanded[id] = !expanded[id]` works in
`Failures.svelte:30`. The reassignment rule matters specifically for
`Set`/`Map`/class instances, which are **not** deeply proxied.

**BAD** — mutate a `Set` in place:

```svelte
<script lang="ts">
  let enabled = $state(new Set<string>());
  function toggle(id: string) {
    enabled.add(id); // ⛔ Set isn't a reactive proxy — UI won't update
  }
</script>
```

**WHY:** Svelte's deep reactivity wraps plain objects and arrays in proxies, but
not `Set`/`Map`/class instances. Calling `.add()`/`.delete()` mutates the
underlying collection without notifying Svelte, so dependents (`$derived`,
markup) don't recompute. Creating a `new Set(...)` and assigning it is a fresh
reference Svelte can see change. (If you need a reactive collection without the
copy, `svelte/reactivity` exports `SvelteSet`/`SvelteMap` — but the copy-on-
write reassignment is the pattern this repo reaches for.)

---

## 5. Keep `load()` server-side; mutate via `fetch`; refresh via `invalidateAll`

**GOOD** — the whole tasks page is built this way. `load()` runs on the server
(`tasks/+page.server.ts:5`):

```ts
export async function load() {
  const [tasks, pipelines, lastProcessor] = await Promise.all([
    listTasks(), pipelineStatus(), readLastProcessorState(),
  ]);
  return { tasks, pipelines, lastProcessor, failures: extractFailures(tasks) };
}
```

Mutations are `fetch()` calls to endpoints, then a refresh — never a local edit
of `data` (`tasks/+page.svelte:32`):

```svelte
<script lang="ts">
  async function approve(id: string) {
    await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
    await invalidateAll(); // ✅ re-run load(), pull fresh server truth
  }
</script>
```

**BAD** — hold a client-side copy and patch it optimistically:

```svelte
<script lang="ts">
  let tasks = $state(data.tasks); // ⛔ now there are two truths
  async function approve(id: string) {
    await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
    const t = tasks.find(t => t.id === id);
    if (t) t.status = "completed"; // ⛔ guessing the server's outcome
  }
</script>
```

**WHY:** the server (task JSON on disk) is the single source of truth. After a
mutation, `invalidateAll()` re-runs every `load()` and the page renders whatever
the server actually decided — including side effects the client can't predict
(a gate failing, a fan-out spawning children, backpressure pausing a task). The
optimistic copy guesses, drifts, and has to be reconciled by hand. Combined with
the 3 s poll (pattern #2), the page is always eventually consistent with disk
for free.

---

## 6. Sanitize untrusted markdown **server-side**

**GOOD** — parse and sanitize in `+page.server.ts`, ship safe HTML to the page
(`marketing/kb/[id]/+page.server.ts`):

```ts
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

export async function load({ params }) {
  const entry = await getKBEntry(params.id);
  const rawHtml = await marked.parse(entry.body ?? "");
  const bodyHtml = DOMPurify.sanitize(rawHtml); // ✅ strip scripts/handlers
  return { entry, bodyHtml };
}
```

```svelte
<!-- the page just renders the already-sanitized string -->
<article>{@html data.bodyHtml}</article>
```

**BAD** — `{@html}` raw, unsanitized markdown/HTML:

```svelte
<article>{@html marked.parse(entry.body)}</article> <!-- ⛔ XSS -->
```

**WHY:** `{@html}` bypasses Svelte's escaping. If the markdown came from anywhere
you don't fully control (a scraped competitor page, a KB entry built from
external text, user input), it can carry `<script>` or `onerror=` payloads.
Sanitizing in the server `load()` with `isomorphic-dompurify` means the
dangerous bits are gone before the string ever reaches the browser, and the
component stays dumb. (The drafts editor `{@html}`s the captain's *own* content,
which is trusted — that's the one place raw `{@html}` is acceptable, and it's a
deliberate exception, not the default.)

---

## 7. Type `$props` with an interface and real defaults

**GOOD** — `Failures.svelte:6` declares a `Props` interface and supplies
defaults at destructure time:

```svelte
<script lang="ts">
  import type { FailureRow } from "./failures.ts";

  interface Props {
    failures: FailureRow[];
    title?: string;
    hideWhenEmpty?: boolean;
    hidePipelineColumn?: boolean;
    pipelineId?: string;
  }

  let {
    failures,
    title = "Failures",
    hideWhenEmpty = true,
    hidePipelineColumn = false,
    pipelineId,
  }: Props = $props();
</script>
```

**BAD** — untyped props with `??` defaults scattered through the template:

```svelte
<script lang="ts">
  let { failures, title, hideWhenEmpty } = $props(); // ⛔ all `any`
</script>
{#if !(hideWhenEmpty ?? true)} ... {/if} <!-- default re-derived everywhere -->
```

**WHY:** the typed interface gives you autocomplete, catches a caller passing the
wrong shape at `npm run check` time, and documents the component's contract in
one place. Defaults belong in the destructure (`title = "Failures"`), so every
read site sees a resolved value and you don't repeat `?? true` in five places.
The untyped form makes every prop `any`, hides typos until runtime, and spreads
default logic across the markup.

---

## Cheat sheet

| Do | Don't |
|---|---|
| `$derived` for computed values | mirror state with `$state` + `$effect` |
| return cleanup from `$effect` | leave intervals/listeners dangling |
| guard prop→state seeding | re-seed every effect run (clobbers edits) |
| reassign `new Set(...)` | mutate a `Set`/`Map` in place |
| `load()` server-side + `fetch` + `invalidateAll()` | client-held source of truth / optimistic patches |
| sanitize untrusted markdown in `load()` | `{@html}` raw user input |
| typed `Props` interface + defaults | untyped `$props()` |

---

## See also

- [svelte-5-primer.md](./svelte-5-primer.md) — rune reference.
- [sveltekit-primer.md](./sveltekit-primer.md) — `load()`, endpoints, `invalidateAll()`.
- [../dashboard/05-components-and-patterns.md](../dashboard/05-components-and-patterns.md)
- [../best-practices/coding.md](../best-practices/coding.md)
