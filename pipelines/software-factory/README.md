# Software factory

Domain namespace for **the system maintaining itself and its own development workflow**. First inhabitant: `daily-housekeeping`. Reserved space for future autonomous-dev pipelines (spec-to-PR, test-triage, dep-bump).

## Why this exists

Phases 1-5 prove the core abstraction for marketing-adjacent work. Phase 6 makes the second domain real — even if its first pipeline is small. The point isn't the housekeeping job. The point is that when you want to ship a real software-factory pipeline (the `spec-to-PR` loop especially), the path is **drop a config + a prompt**, not **rework the core**.

## Active pipelines

| id | what it does |
|---|---|
| `software-factory-housekeeping` | Daily 3 AM. Clears tasks stuck in `paused_backpressure` > 7 days, logs to `logs/housekeeping/<date>.log`. |

## Reserved (planning anchors — not implemented)

| id | one-line scope |
|---|---|
| `spec-to-pr` | Autonomous OpenSpec → branch → PR loop. Picks the next change with applyRequires satisfied, implements tasks.md, runs checks, opens PR. |
| `test-triage` | Watches CI. Flaky test fails twice → needs_review task with failure log + claude-suggested fix. Captain decides. |
| `dep-bump` | Weekly safe patch/minor dep updates as auto-PRs. Major bumps route to needs_review. |

These are documented intent, not commitments. The dashboard surfaces them at `/software-factory` as `reserved` entries so the captain (or a future agent) can see what's planned.

## Adding a new pipeline

The pattern is identical for every domain. From this directory:

1. **Create a pipeline config:**
   ```ts
   // pipelines/software-factory/my-pipeline/pipeline.config.ts
   import type { PipelineConfig } from "../../../core/lib/types.ts";

   export const myPipeline: PipelineConfig = {
     id: "my-pipeline",
     description: "what this pipeline does and why it exists",
     backpressureCap: 5,
     cronSchedule: "0 4 * * *",            // optional
     phases: [
       { id: "step-one", gateType: "auto_pass", run: async (task, ctx) => { /* ... */ return { output: {} }; } },
     ],
   };
   ```

2. **Register it** in `core/lib/registry-bootstrap.ts` (one import + one `registerPipeline()` line).

3. **Add a cron line** to `cron/cron.txt` if it runs on a schedule. Leave it commented out until you've validated it manually.

4. **`/pipelines/my-pipeline`** picks it up automatically. If you want a domain-specific surface, add a SvelteKit route under `dashboard/src/routes/software-factory/my-pipeline/`.

That's it. `core/lib/` is never modified.
