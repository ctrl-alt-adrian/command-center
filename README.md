# Command Center

Single hub for marketing, software factory, and future domains. Built on one primitive: a DAG of **phases** (`claude -p` calls) alternating with **gates** (`needs_review` / `deterministic` / `auto_pass`).

## Status

Phase 1 (scaffold + core runtime + processor with backpressure cap). Marketing, vault, competitors, reddit-pmf, and software-factory pipelines ship in later phases — see `openspec/changes/`.

## Architecture

```
core/lib/            # domain-agnostic runtime
  types.ts           # Task, GateType, PhaseConfig, PipelineConfig
  registry.ts        # pipeline registration
  tasks.ts           # task store (JSON files + file lock)
  claude.ts          # claude -p wrapper
  processor.ts       # cron-driven dispatch + gate eval + backpressure
  slop.ts            # rule-pack engine (rules pluggable per pipeline)

pipelines/
  marketing/         # phase 2
  vault-nuggets/     # phase 3
  competitors/       # phase 4
  reddit-pmf/        # phase 5
  software-factory/  # phase 6

dashboard/           # SvelteKit + Svelte 5 + Tailwind 4 (port 3001)
cron/                # cron entries
cli/                 # slash-command prompts shared across pipelines
signals/             # external signals (per-pipeline subdirs)
tasks/               # task store (one dir per task)
drafts/              # marketing outputs (phase 2)
vault/               # MACHINE-framework KB (phase 3)
logs/                # diagnostics
```

## Adding a pipeline

1. Create `pipelines/<name>/pipeline.config.ts` exporting a `PipelineConfig`.
2. Author the slash-command prompts in `pipelines/<name>/cli/`.
3. Register the pipeline in `core/lib/registry-bootstrap.ts`.
4. Add a cron entry to `cron/cron.txt` if it runs on a schedule.

That's it — `core/lib/` is never modified.

## Throttling

The processor caps how many pending tasks dispatch in one `/api/cron` tick so a
single fan-out (e.g. marketing's 53-task discovery) can't wedge the dashboard
for hours.

- Global default: `PROCESSOR_PER_TICK_CAP=3` (env var; see `.env.example`).
- Per-pipeline override: set `perTickCap` in `pipelines/<name>/pipeline.config.ts`.
  Pipelines with an override run on their own independent budget; pipelines
  without share the global pool.
- Current overrides: `software-factory-housekeeping: 50` (pure file ops),
  `competitors: 5` (slow yt-dlp scrape, no claude spend).
- Pending tasks beyond the cap stay `pending` and surface on `/tasks` as
  "N deferred to next tick". They're dispatched in `createdAt` order (FIFO).

## Setup

```bash
bash setup.sh
```

Installs dashboard deps, copies cron entries, prints next steps.

## Run

```bash
cd dashboard && npm run dev
```

Visit `http://localhost:3001`.
