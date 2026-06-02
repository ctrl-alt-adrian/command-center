# Best Practices — Implementing Features

Step-by-step playbooks for the changes you will actually make. Each one tells you exactly which files to touch, in order, and shows a minimal real skeleton you can copy. They all build on the same primitive: a task flows through `phases[]`, and between phases a **gate** (`auto_pass` / `deterministic` / `needs_review`) decides whether it advances, retries, or waits for you.

Related reading:

- [coding conventions](coding.md) · [testing](testing.md) · [implementing-features ← you are here]
- [Pipelines index](../pipelines/00-index.md) · [processor](../core/03-processor.md) · [gates](../core/04-gates.md) · [slop engine](../core/08-slop-engine.md) · [task store](../core/05-task-store.md) · [API endpoints](../dashboard/03-api-endpoints.md)

## The on-disk model (read this first)

Everything below manipulates this shape. There is no database — a task *is* a directory:

```
tasks/<id>/
  task.json          # the Task record (see core/lib/types.ts:91-105)
  <phaseId>/         # one dir per phase that ran
    output.md        # JSON.stringify of the phase's output (tasks.ts:135-147)
    meta.json        # the same output, when present
logs/processor-<date>.log     # processor event log
logs/processor-state.json     # last tick's counts
```

Key inheritance rules the processor enforces when a task advances (`core/lib/processor.ts:306-368`):

- **Single advance**: the child's `input` = parent `input` + parent `output` + `previousTaskId`.
- **Fan-out advance**: each child's `input` = parent `input` + that child's element + `previousTaskId`. Children do **not** inherit the parent's `output` (a 428-element candidates array would otherwise be copied into every child — `processor.ts:325-332`). If a child needs a slice of the parent output, put it in the fan-out element.
- `parentId` chains to the *root* of the run (`task.parentId ?? task.id`).
- A gate retry **rewinds to the previous phase** and exposes the failure reason as `input.gateRetryFeedback` for the upstream phase to read.

---

## Playbook 1 — Add a new pipeline (4 steps)

This is the README contract (`README.md:38-44`): create config → author prompts → register → cron. `core/lib/` is never touched.

### Step 1 — Create `pipelines/<name>/pipeline.config.ts`

Export a `PipelineConfig`. Minimal one-phase auto-pass pipeline that calls claude:

```ts
import type { PipelineConfig } from "../../core/lib/types.ts";
import { claude } from "../../core/lib/claude.ts";

export const myPipeline: PipelineConfig = {
  id: "my-pipeline",                      // unique; matches the cron POST body
  description: "What this domain does, in one sentence.",
  // backpressureCap?: 5  — pause new work when this many tasks are needs_review
  // perTickCap?: 3       — own per-tick dispatch budget (else shares global pool)
  // fanOutBatchSize?: 25 — cap how many fan-out children start as `pending`
  phases: [
    {
      id: "do-the-thing",
      gateType: "auto_pass",              // no review, no check — just advance/complete
      timeoutMs: 5 * 60 * 1000,
      run: async (task, ctx) => {
        ctx.log("starting", { input: task.input });
        const out = await claude("Summarize this:\n\n" + String(task.input.text ?? ""), {
          model: "claude-sonnet-4-6",
        });
        return { output: { summary: out } };   // becomes the next/child task's input
      },
    },
  ],
};
```

Put domain logic in `pipelines/<name>/lib/*.ts` and import it into the config — keep `pipeline.config.ts` thin (see [testing](testing.md) for *why* this separation matters). Export a `pipelines/<name>/paths.ts` that builds on `COMMAND_CENTER_ROOT` rather than hardcoding paths ([coding §5](coding.md)).

References to crib from: `pipelines/personal-brand/pipeline.config.ts` (discovery → fan-out → generate → review) and `pipelines/marketing/pipeline.config.ts` (adds a deterministic slop gate).

### Step 2 — Author the slash-command prompts in `pipelines/<name>/cli/`

If your `run()` calls claude with a reusable prompt, store it as a markdown file and load it once (cache it — `personal-brand/lib/generate.ts:28-33` caches `write-post.md`). Templated tokens like `{{platform}}` get `replaceAll`-substituted at call time.

### Step 3 — Register in `core/lib/registry-bootstrap.ts`

Two lines — an import and a `registerPipeline` call:

```ts
import { myPipeline } from "../../pipelines/my-pipeline/pipeline.config.ts";
// …inside bootstrapPipelines():
registerPipeline(myPipeline);
```

This is the *only* file in `core/lib/` that ever imports pipeline code (`registry-bootstrap.ts:1-2`). Registration is idempotent — overwrite is fine ([coding §12](coding.md)).

### Step 4 — Add a cron entry to `cron/cron.txt` + reinstall

Trigger a run by POSTing the pipeline id to `/api/tasks` on a schedule. Tag the line with the `command-center` marker so `setup.sh` manages it:

```cron
0 9 * * * curl -s -X POST http://localhost:3001/api/tasks -H 'content-type: application/json' -d '{"pipelineId":"my-pipeline"}' > /dev/null 2>&1  # command-center my-pipeline
```

Then `bash setup.sh` — it greps out old `command-center` lines and re-adds from `cron.txt` (idempotent). Verify with `npm run check`.

---

## Playbook 2 — Add a phase to an existing pipeline

Insert a `PhaseConfig` into `phases[]` at the right position — order *is* the DAG (`registry.ts:22-38` resolves next/previous by array index).

```ts
// new phase inserted between generate and review
const verifyPhase: PhaseConfig = {
  id: "verify",
  gateType: "deterministic",                 // pick the gate (see below)
  retryPolicy: { maxAttempts: 3 },           // gate retries before giving up
  run: async (task, ctx) => {
    // optional: read input.gateRetryFeedback if this phase can be the rewind target
    const feedback = task.input.gateRetryFeedback as string | undefined;
    /* produce the artifact this gate will check */
    return { output: {} };
  },
  check: async (task) => {                    // required for deterministic
    const ok = /* … */ true;
    return ok ? { pass: true } : { pass: false, reason: "what was wrong" };
  },
};
// phases: [discoveryPhase, generatePhase, verifyPhase, reviewPhase]
```

**Pick the gateType** ([gates](../core/04-gates.md)):

- `auto_pass` — advance immediately after `run()`. No gate logic.
- `deterministic` — `check(task)` returns `{ pass, reason? }`. On fail, the processor **rewinds to the previous phase** with `input.gateRetryFeedback = reason` and `gateRetryCount++`, up to `retryPolicy.maxAttempts` (`processor.ts:241-303`). After exhaustion it goes `needs_review` with `gateFailReason` set (and you can't approve past it — `approveTask` refuses, `processor.ts:388-392`).
- `needs_review` — task parks for the captain on `/tasks`. You approve/reject in the UI.

**Remember:**

- A deterministic gate that can be rewound to should have its upstream phase read `input.gateRetryFeedback` and regenerate accordingly (this is exactly marketing's slop loop: slop-check fails → rewind to generate → generate reads the feedback → fresh drafts — `processor.ts:259-282`).
- If the new phase should expand into many downstream tasks, add a `fanOut` (Playbook 6).
- Use `onExhausted` to clean up artifacts when a deterministic gate gives up (e.g. marketing deletes failing draft files so they can't be mistaken for usable output — `types.ts:38-44`, `marketing/pipeline.config.ts:151+`).

---

## Playbook 3 — Add a deterministic gate / slop pack

A "slop pack" is a named set of regex rules the slop engine runs against text (`core/lib/slop.ts`). Two steps: register the pack once, then `runRules` inside a `check()`.

**Register the pack** (load lazily, guard against double-registration):

```ts
import { registerSlopPack, type SlopRule } from "../../core/lib/slop.ts";

let slopBootstrap: Promise<void> | null = null;
async function ensureSlopLoaded() {
  if (!slopBootstrap) slopBootstrap = loadMyRules();   // single-flight; parallel ticks won't double-register
  await slopBootstrap;
}
async function loadMyRules() {
  const rules: SlopRule[] = [
    { id: "no-emdash", pattern: /—/, severity: "fail", message: "no em-dashes" },
  ];
  registerSlopPack("my-pack", rules);
}
```

`marketing/lib/slop-loader.ts` is the real reference — it reads YAML rule files and translates `(?i)` prefixes into a JS `i` flag.

**Run it in the gate's `check()`** (`marketing/pipeline.config.ts:112-149`):

```ts
import { runRules } from "../../core/lib/slop.ts";

check: async (task) => {
  await ensureSlopLoaded();
  const text = /* read the artifact this phase produced */ "";
  const result = runRules(text, "my-pack");    // { pass, violations[] }
  if (result.pass) return { pass: true };
  const feedback = result.violations
    .filter((v) => v.severity === "fail")
    .map((v) => `L${v.line} [${v.ruleId}]: "${v.excerpt}"`)
    .join("\n");
  return { pass: false, reason: feedback };     // reason becomes gateRetryFeedback upstream
},
```

`runRules` throws if the pack isn't registered (`slop.ts:38`), and `pass` is false only when a `fail`-severity rule matches (`warn` rules surface but don't gate). See [slop engine](../core/08-slop-engine.md).

---

## Playbook 4 — Add a dashboard page

A dashboard page is a `+page.server.ts` (`load()` reads core) plus a `+page.svelte` (renders props, polls).

**`load()` — read core, degrade gracefully, parallelize** (`dashboard/src/routes/personal-brand/+page.server.ts`):

```ts
import { listTasksByPipeline } from "../../../../core/lib/tasks.ts";
import { countTasksByStatus } from "$lib/failures";

export async function load() {
  const [things, tasks] = await Promise.all([
    loadMyThings().catch(() => []),                 // §8: one bad read ≠ 500
    listTasksByPipeline("my-pipeline"),
  ]);
  const c = countTasksByStatus(tasks);
  return { thingCount: things.length, needsReview: c.needs_review, failedCount: c.failed };
}
```

**`+page.svelte` — `$props`, render, poll** (`dashboard/src/routes/tasks/+page.svelte:1-11`):

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  let { data } = $props();                          // Svelte 5 runes

  $effect(() => {                                   // live-refresh loop
    const id = setInterval(() => invalidateAll(), 3000);
    return () => clearInterval(id);
  });
</script>
```

Use `invalidateAll()` after every action and to poll — it re-runs `load()`. Don't add a fresh fs walk to `load()`; route through a cached `list*()` ([coding §3](coding.md)). See [Svelte primer](../primers/svelte-best-practices.md).

---

## Playbook 5 — Add an API endpoint

A `+server.ts` under `dashboard/src/routes/api/...` exporting `GET`/`POST`/etc. Validate, call a core function, return `json()` or `error()`.

```ts
// dashboard/src/routes/api/tasks/[id]/approve/+server.ts (real)
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
    throw err;   // re-throw SvelteKit errors untouched
  }
}
```

Conventions: keep the endpoint thin — all logic lives in the core function it calls. Parse the body defensively (`await request.json().catch(() => ({}))` — see `api/tasks/+server.ts:18`). Map known error strings to HTTP codes (the 409 above; 400 for bad input; 404 for missing). Return `json({ … })`. See [API endpoints](../dashboard/03-api-endpoints.md).

---

## Playbook 6 — Add a fan-out

A `fanOut(task)` on a phase makes the processor create **one child per returned element** when the task advances, instead of a single child. `fanOutBatchSize` caps how many start `pending`.

**Define `fanOut`** (`personal-brand/pipeline.config.ts:41-56`):

```ts
fanOut: async (task) => {
  const candidates = (task.output as { candidates: BrandCandidate[] }).candidates ?? [];
  // Each element is merged into a child's input. Put everything the child needs HERE —
  // children do NOT inherit the parent's output.
  return candidates.map((c) => ({ candidate: { id: c.id, title: c.title, body: c.body } }));
},
```

```ts
// at the top of the pipeline config — batch the fan-out
export const myPipeline: PipelineConfig = {
  id: "my-pipeline",
  fanOutBatchSize: 25,   // first 25 children → pending; rest → paused_user (inert)
  phases: [ /* … */ ],
};
```

**How it behaves** (`processor.ts:317-354`):

- `fanOut` returning `[]` completes the parent (nothing to expand — `fanout_empty`).
- The first `fanOutBatchSize` children get `status: "pending"`; the rest get `status: "paused_user"` and sit inert.
- The captain drains the paused batch with **"Resume next batch"** on `/tasks`, which POSTs `/api/tasks/resume` (`resumePausedUserTasks` flips the next N `paused_user` → `pending`, oldest first — `processor.ts:408-427`).

This exists so one approval (e.g. discovery picking 204 candidates) doesn't kick off hundreds of claude calls at once (`types.ts:71-79`). Combine with `perTickCap`/the global `PROCESSOR_PER_TICK_CAP` for a second layer of throttling (`README.md:47-60`).

---

## Where things plug in — quick map

| Change | Touch | Don't touch |
|---|---|---|
| New pipeline | `pipelines/<name>/`, `registry-bootstrap.ts`, `cron/cron.txt` | `core/lib/` |
| New phase | one `pipelines/<name>/pipeline.config.ts` | `core/lib/` |
| New gate/slop | pipeline config + `lib/slop-loader.ts` | `core/lib/slop.ts` |
| New dashboard page | `dashboard/src/routes/<page>/` | core (call its `list*`) |
| New API endpoint | `dashboard/src/routes/api/.../+server.ts` | core (call its fn) |
| New generic capability | `core/lib/types.ts` + processor (generic field) | per-pipeline branches |

After any change: `npm run check`, then the manual loop in [testing](testing.md).
