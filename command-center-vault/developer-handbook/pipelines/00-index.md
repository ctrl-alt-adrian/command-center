# Pipelines — Index

Every pipeline is a `PipelineConfig` (`core/lib/types.ts:59`) registered in `core/lib/registry-bootstrap.ts`. The domain-agnostic processor (`../core/03-processor.md`) drives all of them through the same loop: dispatch a phase's `run()`, evaluate its gate (`../core/04-gates.md`), then advance / fan-out / rewind.

There are **8 registered pipeline configs** across **9 logical pipelines** (reddit-pmf ships two configs from one file). One more namespace (`software-factory`) carries three *reserved* unregistered planning anchors.

## Summary table

| id | page | phases | gate types (in order) | cron | input source | status |
|---|---|---|---|---|---|---|
| `marketing` | [marketing](marketing.md) | 4: discovery → generate → slop-check → review | needs_review · auto_pass · deterministic(3) · needs_review | `0 11 * * *` (commented in `cron.txt`) | cron POST `/api/tasks` | **Working**; one known gap (`markUsedForContent` no-ops on `vault:` ids) |
| `vault-nuggets` | [vault-nuggets](vault-nuggets.md) | 2: extract → embed | needs_review · auto_pass | `0 9 * * *` | cron POST `/api/tasks` | **Working** |
| `competitors` | [competitors](competitors.md) | 1: scrape | auto_pass | `0 10 * * *` | cron POST `/api/tasks` | **Working** (depends on `yt-dlp` binary) |
| `reddit-pmf` | [reddit-pmf](reddit-pmf.md) | 3: scrape → extract → deploy | auto_pass · auto_pass · auto_pass | `0 8 * * 1` | cron POST `/api/tasks` | **Working through dry-run**; vercel push NOT implemented |
| `reddit-pmf-metrics` | [reddit-pmf](reddit-pmf.md) | 1: sweep | auto_pass | `0 17 * * 5` | cron POST `/api/tasks` | **Stub** (emits `ctr:null`/`signups:null`) |
| `software-factory-housekeeping` | [software-factory](software-factory.md) | 1: clear-stale | auto_pass | `0 3 * * *` | cron POST `/api/tasks` | **Working** (pure file-ops) |
| `rolenext-bug-resolver` | [rolenext-bug-resolver](rolenext-bug-resolver.md) | 7: poll-issues → triage → write-handoff → fix → verify → pr → post-mortem | auto_pass · deterministic(1) · auto_pass · auto_pass · deterministic(1) · auto_pass · auto_pass | `*/15 * * * *` | cron POST `/api/tasks` | **Working** in v1 (investigate-only; `enableBrowserRepro:false`) |
| `rolenext-job-apply` | [rolenext-job-apply](rolenext-job-apply.md) | 4: discover → select → prep → mark-applied | auto_pass · needs_review · deterministic(2) · needs_review | none (manual) | manual POST `/api/tasks` | **Working** (needs `ROLENEXT_JWT`) |
| `personal-brand` | [personal-brand](personal-brand.md) | 3: discovery → generate → review | needs_review · auto_pass · needs_review | none (manual) | manual POST `/api/tasks` | **Working** (most tasks on disk: 178) |

Reserved (NOT registered, shown on `/software-factory` only): `spec-to-pr`, `test-triage`, `dep-bump` — see [software-factory](software-factory.md).

### Per-tick budgets and fan-out

| id | `backpressureCap` | `perTickCap` | `fanOutBatchSize` |
|---|---|---|---|
| `marketing` | 5 | 25 | 50 |
| `vault-nuggets` | 5 | 1 | — |
| `competitors` | 5 | 5 | — |
| `reddit-pmf` | 5 | — (global pool) | — |
| `reddit-pmf-metrics` | 5 | — | — |
| `software-factory-housekeeping` | 5 | 50 | — |
| `rolenext-bug-resolver` | 5 | 5 | — |
| `rolenext-job-apply` | 5 | 3 | 10 |
| `personal-brand` | 5 | — | 25 |

`backpressureCap` defaults to 5 (`DEFAULT_BACKPRESSURE_CAP`); pipelines without a `perTickCap` share the global `PROCESSOR_PER_TICK_CAP` pool (`DEFAULT_PROCESSOR_PER_TICK_CAP = 10`). See `core/lib/types.ts:107-110`.

## How to add a pipeline

From `README.md:38-44` (and `pipelines/software-factory/README.md:26-51`) — **`core/lib/` is never modified**:

1. **Create `pipelines/<name>/pipeline.config.ts`** exporting a `PipelineConfig`. Put pipeline-specific logic under `pipelines/<name>/lib/` and (for multi-phase configs) `pipelines/<name>/phases/`.
2. **Author the slash-command / agent prompts** in `pipelines/<name>/cli/` (or `prompts/` for the rolenext pipelines). These are read at runtime via `fs.readFile`.
3. **Register it** in `core/lib/registry-bootstrap.ts` — one `import` + one `registerPipeline(...)` line inside `bootstrapPipelines()`.
4. **Add a cron entry** to `cron/cron.txt` if it runs on a schedule (a `curl -X POST /api/tasks -d '{"pipelineId":"<name>"}'` line). Leave it commented until validated manually.

`/pipelines/<name>` on the dashboard picks the pipeline up automatically once registered. The full worked example is in [../best-practices/implementing-features.md](../best-practices/implementing-features.md).

### What a phase can do

`PhaseConfig` (`core/lib/types.ts:22-45`) hooks the processor calls per phase:

- `run(task, ctx)` → `{ output?, outputFiles? }`. `ctx` = `{ taskDir, inputDir (prev phase dir), outputDir, log }`.
- `check(task)` → `{ pass, reason? }` — gate predicate for `deterministic` and `needs_review` gates.
- `fanOut(task)` → `Array<Record<string,unknown>>` — one child task per element on advance.
- `onExhausted(task, reason)` — fired when a `deterministic` gate burns its retry budget, just before the task lands in `needs_review`.

Claude is reached via `core/lib/claude.ts`: `claude(prompt, opts)` / `claudeSlash(slash, body, opts)` (`../core/06-claude-wrapper.md`). The two rolenext agent pipelines bypass this with a per-pipeline `claudeInCwd()` so the agent runs inside a git worktree.
