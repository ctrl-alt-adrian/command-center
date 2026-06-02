# Core 07 — Registry & Bootstrap (`registry.ts`, `registry-bootstrap.ts`)

Pipelines are registered into an in-memory map at process startup and looked up by id throughout the runtime. Two files split the job: `registry.ts` is the **domain-agnostic store and navigation helpers** (it imports no pipeline code), and `registry-bootstrap.ts` is the **single place that imports every pipeline** and registers it. This split is the architectural firewall that keeps `core/lib/` free of domain knowledge.

> Prereqs: [01-data-model.md](01-data-model.md) (`PipelineConfig`, `PhaseConfig`). See [`../pipelines/00-index.md`](../pipelines/00-index.md) for the pipelines themselves.

---

## `registry.ts` — the store

```ts
// core/lib/registry.ts:1-12
import type { PipelineConfig } from "./types.ts";

const pipelines = new Map<string, PipelineConfig>();

export function registerPipeline(config: PipelineConfig): void {
  if (config.phases.length === 0) {
    throw new Error(`Pipeline ${config.id} has no phases`);
  }
  // Idempotent: overwrite is fine. Dev-mode HMR re-evaluates bootstrap; production
  // calls it once at server init.
  pipelines.set(config.id, config);
}
```

A module-level `Map<string, PipelineConfig>` keyed by `config.id`. `registerPipeline`:

- **Throws if a pipeline has zero phases** — a phaseless pipeline is meaningless (the processor would have nothing to dispatch), so this is caught at registration, not at runtime.
- **Is idempotent** — re-registering the same id overwrites. This matters in dev: SvelteKit/Vite HMR re-evaluates the bootstrap module, calling `registerPipeline` again; overwrite-is-fine means no "already registered" error. In production it's called once.

### Lookup and navigation

```ts
// core/lib/registry.ts:14-46
export function getPipeline(id: string): PipelineConfig | undefined {
  return pipelines.get(id);
}

export function listPipelines(): PipelineConfig[] {
  return Array.from(pipelines.values());
}

export function nextPhase(config: PipelineConfig, currentPhaseId: string): string | null {
  const idx = config.phases.findIndex((p) => p.id === currentPhaseId);
  if (idx < 0 || idx >= config.phases.length - 1) return null;
  return config.phases[idx + 1].id;
}

export function previousPhase(config: PipelineConfig, currentPhaseId: string): string | null {
  const idx = config.phases.findIndex((p) => p.id === currentPhaseId);
  if (idx <= 0) return null;
  return config.phases[idx - 1].id;
}

export function getPhase(config: PipelineConfig, phaseId: string) {
  return config.phases.find((p) => p.id === phaseId);
}

export function isFirstPhase(config: PipelineConfig, phaseId: string): boolean {
  return config.phases[0]?.id === phaseId;
}
```

These are the navigation primitives the [processor](03-processor.md) leans on:

| Function | Returns | Used for |
| --- | --- | --- |
| `getPipeline(id)` | `PipelineConfig \| undefined` | dispatch lookup; `undefined` → task is failed as "unknown pipeline" |
| `listPipelines()` | all configs | `pipelineStatus`, bootstrapping enabled-map |
| `nextPhase(config, id)` | next phase id or `null` | `advanceOrComplete` — `null` means "last phase → complete" |
| `previousPhase(config, id)` | previous phase id or `null` | gate rewind target — `null` means "no rewind, in-place retry" |
| `getPhase(config, id)` | `PhaseConfig \| undefined` | resolve the current phase before running it |
| `isFirstPhase(config, id)` | boolean | only first-phase tasks can be `paused_backpressure` |

Edge behavior to remember:

- `nextPhase` returns `null` for both an unknown phase (`idx < 0`) **and** the last phase (`idx >= length - 1`). The processor treats `null` as "complete".
- `previousPhase` returns `null` for both the first phase (`idx <= 0`) and an unknown phase. The gate uses this to choose rewind vs. in-place retry.

### Test helper

```ts
// core/lib/registry.ts:48-51
// Test helper. Production code should not call this.
export function _resetRegistry(): void {
  pipelines.clear();
}
```

Clears the map. Only for tests (so each test starts with an empty registry). Never call it in production — it would unregister every pipeline mid-run.

---

## `registry-bootstrap.ts` — the one place that imports pipelines

```ts
// core/lib/registry-bootstrap.ts:1-24
// Central pipeline registration. Each new domain adds an import and a register call here.
// core/lib/ does not import any pipeline-specific code other than through this file.

import { registerPipeline } from "./registry.ts";
import { marketingPipeline } from "../../pipelines/marketing/pipeline.config.ts";
import { vaultNuggetsPipeline } from "../../pipelines/vault-nuggets/pipeline.config.ts";
import { competitorsPipeline } from "../../pipelines/competitors/pipeline.config.ts";
import { redditPmfPipeline, redditPmfMetricsPipeline } from "../../pipelines/reddit-pmf/pipeline.config.ts";
import { softwareFactoryHousekeepingPipeline } from "../../pipelines/software-factory/pipeline.config.ts";
import { rolenextBugResolverPipeline } from "../../pipelines/rolenext/bug-resolver/pipeline.config.ts";
import { rolenextJobApplyPipeline } from "../../pipelines/rolenext/job-apply/pipeline.config.ts";
import { personalBrandPipeline } from "../../pipelines/personal-brand/pipeline.config.ts";

export function bootstrapPipelines(): void {
  registerPipeline(marketingPipeline);
  registerPipeline(vaultNuggetsPipeline);
  registerPipeline(competitorsPipeline);
  registerPipeline(redditPmfPipeline);
  registerPipeline(redditPmfMetricsPipeline);
  registerPipeline(softwareFactoryHousekeepingPipeline);
  registerPipeline(rolenextBugResolverPipeline);
  registerPipeline(rolenextJobApplyPipeline);
  registerPipeline(personalBrandPipeline);
}
```

`bootstrapPipelines()` registers **nine** pipeline configs (note: eight import statements, but `reddit-pmf` exports two — `redditPmfPipeline` and `redditPmfMetricsPipeline`):

1. `marketingPipeline`
2. `vaultNuggetsPipeline`
3. `competitorsPipeline`
4. `redditPmfPipeline`
5. `redditPmfMetricsPipeline`
6. `softwareFactoryHousekeepingPipeline`
7. `rolenextBugResolverPipeline`
8. `rolenextJobApplyPipeline`
9. `personalBrandPipeline`

### The architectural rule (the most important thing on this page)

> **`core/lib/` imports NO pipeline-specific code — except through this one file.**

Everything else in `core/lib/` depends only on the *types* (`PipelineConfig`/`PhaseConfig`) and the registry's `Map`. It never `import`s a concrete pipeline. The processor doesn't know `marketing` exists; it only knows "some pipeline with id X is in the map." `registry-bootstrap.ts` is the **single, intentional exception** — the seam where domain code is wired in.

Consequences you can rely on:

- To **add a pipeline**: create `pipelines/<name>/pipeline.config.ts` exporting a `PipelineConfig`, then add one import + one `registerPipeline(...)` line here. Nothing else in core changes.
- To **remove a pipeline**: delete its import + register line. Core is unaffected (any existing tasks for it will `fail` as "unknown pipeline" on their next dispatch — that's the expected, safe behavior).
- Because this is the only inbound edge from core→pipelines, you can reason about core in isolation: read `core/lib/` and you've read the whole engine, no domain code required.

> **Goodbye note:** Resist the temptation to `import` a pipeline directly from anywhere else in `core/lib/`. The moment a core module imports a concrete pipeline, the firewall is breached and core stops being domain-agnostic — you lose the ability to reason about the engine without reading every pipeline. Keep all pipeline imports funneled through `registry-bootstrap.ts`.

---

## How and when bootstrap runs

The dashboard calls `bootstrapPipelines()` exactly once at server startup, from `dashboard/src/hooks.server.ts`:

```ts
// dashboard/src/hooks.server.ts
import { bootstrapPipelines } from "../../core/lib/registry-bootstrap.ts";

loadRootDotenv();
bootstrapPipelines();

export async function handle({ event, resolve }) {
  return resolve(event);
}
```

`hooks.server.ts` runs once when the SvelteKit server boots (before handling requests). So by the time any request hits an endpoint — or the processor runs a tick — the registry is fully populated. The `loadRootDotenv()` call just before it seeds `process.env` from the repo-root `.env` (so env-driven knobs like `PROCESSOR_PER_TICK_CAP`, `CLAUDE_CONCURRENCY`, `COMMAND_CENTER_ROOT` are available).

> **Goodbye note:** If you run the processor or any core code **outside** the dashboard (a standalone script, a test harness, a cron worker), you MUST call `bootstrapPipelines()` yourself first — otherwise `getPipeline(...)` returns `undefined` for everything and every task fails as "unknown pipeline." This is the #1 gotcha when scripting against core directly.

See [`../dashboard/03-api-endpoints.md`](../dashboard/03-api-endpoints.md) for how the dashboard drives ticks once bootstrap has run.

---

## Where to go next

- [`../pipelines/00-index.md`](../pipelines/00-index.md) — the nine pipelines and their phase configs.
- [03-processor.md](03-processor.md) — every consumer of `getPipeline`/`getPhase`/`nextPhase`/`previousPhase`/`isFirstPhase`.
- [01-data-model.md](01-data-model.md) — the `PipelineConfig` shape registered here.
