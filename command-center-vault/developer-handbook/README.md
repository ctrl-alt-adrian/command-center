# Command Center — Developer Handbook

> **START HERE.** This handbook exists so that one person can run, debug, and
> extend Command Center alone, with no AI assistance. Every page is written
> against the real source — code excerpts carry `path:line` references so you
> can always go check the ground truth for yourself.

## What this is

Command Center is a single Node + SvelteKit hub that runs many automation
**pipelines** on top of one shared runtime. Each pipeline is a DAG of **phases**
(usually `claude -p` calls) separated by **gates** (`needs_review` /
`deterministic` / `auto_pass`). An OS cron job pokes the dashboard once a minute;
the dashboard runs one **processor tick**, which advances every ready task by one
phase. A human — the **captain** — reviews the tasks that land on a
`needs_review` gate.

If you read nothing else, read [01-overview.md](01-overview.md) and
[02-architecture.md](02-architecture.md). They give you the whole mental model.

## Recommended reading order

1. [01-overview.md](01-overview.md) — what the system is and the 9 pipelines.
2. [02-architecture.md](02-architecture.md) — the three layers and the on-disk data model.
3. [03-getting-started.md](03-getting-started.md) — install, run, type-check.
4. [core/01-data-model.md](core/01-data-model.md) → [core/10-utilities.md](core/10-utilities.md) — the runtime, in dependency order.
5. [dashboard/01-stack-and-bootstrap.md](dashboard/01-stack-and-bootstrap.md) → [dashboard/05-components-and-patterns.md](dashboard/05-components-and-patterns.md) — the UI/API layer.
6. [pipelines/00-index.md](pipelines/00-index.md) and the individual pipeline pages — the domains.
7. [operations/](operations/configuration.md) — running it for real.
8. [primers/](primers/svelte-5-primer.md) and [best-practices/](best-practices/coding.md) — when you need to write code and the framework idioms aren't second nature.

## 30-minute orientation path

You have half an hour and need a working mental model. Read, in order:

1. [01-overview.md](01-overview.md) — 10 min. The phase/gate/task/captain primitives.
2. [02-architecture.md](02-architecture.md) — 10 min. Layers, directory map, the cron → `/api/cron` → `runProcessor()` heartbeat.
3. [core/02-task-lifecycle.md](core/02-task-lifecycle.md) — 5 min. How a task moves through statuses.
4. [operations/troubleshooting.md](operations/troubleshooting.md) — 5 min. So you know where to look when it breaks.

After this you can read the dashboard at `http://localhost:3001/tasks` and
understand what you're seeing.

## "I need to add a feature" path

The golden rule: **`core/lib/` is never modified to add a domain.** New behavior
lives in a pipeline, the dashboard, or both.

1. [02-architecture.md](02-architecture.md) — confirm which layer your change belongs in.
2. [core/01-data-model.md](core/01-data-model.md) — the `PipelineConfig` / `PhaseConfig` / `Task` types you'll author against.
3. [core/03-processor.md](core/03-processor.md) and [core/04-gates.md](core/04-gates.md) — exactly how phases run and how gates branch, so your config does what you expect.
4. [pipelines/00-index.md](pipelines/00-index.md) — pick the closest existing pipeline as a template and read its page.
5. [best-practices/implementing-features.md](best-practices/implementing-features.md) — the workflow.
6. [best-practices/testing.md](best-practices/testing.md) and [best-practices/coding.md](best-practices/coding.md) — conventions and the `npm run check` gate.
7. If the feature has UI: [dashboard/05-components-and-patterns.md](dashboard/05-components-and-patterns.md) and the relevant primer in [primers/](primers/svelte-5-primer.md).

## Full table of contents

### Top level
- [README.md](README.md) — this page: index and orientation paths.
- [01-overview.md](01-overview.md) — what Command Center is; the 9 pipelines and their working-vs-stub status.
- [02-architecture.md](02-architecture.md) — the three layers, on-disk data model, and the cron heartbeat flow.
- [03-getting-started.md](03-getting-started.md) — setup, dev loop, type-check, required tools on PATH.
- [glossary.md](glossary.md) — every key term defined, linked to the page that explains it.

### core/ — the domain-agnostic runtime (`core/lib/`)
- [core/01-data-model.md](core/01-data-model.md) — `types.ts`: Task, GateType, PhaseConfig, PipelineConfig, defaults.
- [core/02-task-lifecycle.md](core/02-task-lifecycle.md) — task statuses and the transitions between them.
- [core/03-processor.md](core/03-processor.md) — `processor.ts`: one tick, dispatch, fan-out, requeue.
- [core/04-gates.md](core/04-gates.md) — the three gate types and the deterministic-gate rewind/retry logic.
- [core/05-task-store.md](core/05-task-store.md) — `tasks.ts`: JSON files + file lock; reading and writing tasks.
- [core/06-claude-wrapper.md](core/06-claude-wrapper.md) — `claude.ts`: shelling out to the `claude` CLI, the concurrency semaphore, RateLimitError.
- [core/07-registry-bootstrap.md](core/07-registry-bootstrap.md) — `registry.ts` + `registry-bootstrap.ts`: how pipelines get registered.
- [core/08-slop-engine.md](core/08-slop-engine.md) — `slop.ts`: the pluggable rule-pack engine.
- [core/09-vault-reader.md](core/09-vault-reader.md) — `vault.ts`: reading the MACHINE-framework knowledge base.
- [core/10-utilities.md](core/10-utilities.md) — `paths.ts`, `io.ts`, `lock.ts`, `log.ts`, `utils.ts`, `cache.ts`, `pipelineState.ts`.

### dashboard/ — the SvelteKit thin shell
- [dashboard/01-stack-and-bootstrap.md](dashboard/01-stack-and-bootstrap.md) — SvelteKit 2.57 / Svelte 5 / Tailwind 4 / Vite 8; `hooks.server.ts` boot.
- [dashboard/02-routing-and-loads.md](dashboard/02-routing-and-loads.md) — file-based routing, `+page.server.ts` loads.
- [dashboard/03-api-endpoints.md](dashboard/03-api-endpoints.md) — every `+server.ts` endpoint and what it calls.
- [dashboard/04-full-stack-trace.md](dashboard/04-full-stack-trace.md) — one request traced end-to-end (cron → processor → disk → page).
- [dashboard/05-components-and-patterns.md](dashboard/05-components-and-patterns.md) — shared components and Svelte-5 patterns in use.

### pipelines/ — the domains
- [pipelines/00-index.md](pipelines/00-index.md) — the registry, status table, and how to add a pipeline.
- [pipelines/marketing.md](pipelines/marketing.md) — content discovery → generate → slop-check → review → drafts.
- [pipelines/vault-nuggets.md](pipelines/vault-nuggets.md) — extract atomic notes into the vault.
- [pipelines/competitors.md](pipelines/competitors.md) — yt-dlp competitor scrape.
- [pipelines/reddit-pmf.md](pipelines/reddit-pmf.md) — reddit market-signal mining (deploy is dry-run only).
- [pipelines/software-factory.md](pipelines/software-factory.md) — daily housekeeping over task/vault artifacts.
- [pipelines/rolenext-bug-resolver.md](pipelines/rolenext-bug-resolver.md) — poll GitHub issues, investigate (v1 investigate-only).
- [pipelines/rolenext-job-apply.md](pipelines/rolenext-job-apply.md) — RoleNext job-apply (needs `ROLENEXT_JWT`).
- [pipelines/personal-brand.md](pipelines/personal-brand.md) — per-platform personal brand content.

### vault/ — the knowledge base
- [vault/01-machine-framework.md](vault/01-machine-framework.md) — the MACHINE atomic-note framework.
- [vault/02-how-content-lands.md](vault/02-how-content-lands.md) — how pipeline output becomes vault notes.

### primers/ — framework refreshers
- [primers/svelte-5-primer.md](primers/svelte-5-primer.md) — Svelte 5 runes.
- [primers/svelte-best-practices.md](primers/svelte-best-practices.md) — idioms for this codebase.
- [primers/sveltekit-primer.md](primers/sveltekit-primer.md) — routing, loads, endpoints, adapter-node.
- [primers/typescript-node-primer.md](primers/typescript-node-primer.md) — `type: module`, explicit `.ts` imports, Node APIs.
- [primers/rust-tauri-primer.md](primers/rust-tauri-primer.md) — context note: this project has **no** Rust/Tauri.

### best-practices/
- [best-practices/coding.md](best-practices/coding.md) — code conventions.
- [best-practices/implementing-features.md](best-practices/implementing-features.md) — the feature workflow.
- [best-practices/testing.md](best-practices/testing.md) — how to validate changes.

### operations/
- [operations/configuration.md](operations/configuration.md) — every environment variable.
- [operations/cron-and-scheduling.md](operations/cron-and-scheduling.md) — every cron line decoded.
- [operations/troubleshooting.md](operations/troubleshooting.md) — the runbook.

---

A note on trust: where this handbook quotes code, it quotes the file as it was
read during authoring. If a quote ever disagrees with the file on disk, **the
file wins** — go read it and update the page.
