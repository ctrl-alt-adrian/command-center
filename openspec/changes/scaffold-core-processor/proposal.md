## Why

Marketing-pipeline ships a working DAG (discovery → generate → slop-check → review) but the runtime, task store, slop gate, and processor are tangled into that one domain. The Command Center is the next iteration: a single hub that runs marketing, software factory, and future domains on the same primitive — phases (claude -p calls) alternating with gates (needs_review / deterministic / auto-pass). Before any domain is ported, we need a domain-agnostic core extracted and verified, including the backpressure cap (≤5 needs_review tasks per pipeline) that marketing-pipeline is missing today and that the docx flags as the difference between an engine that serves the captain and one that owns him.

## What Changes

- Create the `command-center/` SvelteKit + Svelte 5 + Tailwind 4 scaffold (matching marketing-pipeline's stack).
- Introduce a `core/` library that owns the pipeline runtime: phase definition, gate types, task transitions, task persistence, processor loop, claude CLI wrapper, slop engine shell (rules pluggable), and signal store.
- Make pipeline DAGs **declarative** via `pipeline.config.ts` files so each domain registers itself with core rather than reimplementing orchestration.
- Add a **global backpressure cap**: the processor refuses to create a new top-of-pipeline task when ≥5 tasks for that pipeline are sitting in `needs_review`.
- Add a global task queue UI route at `/tasks` that shows backlog and cap status across all pipelines.
- No domain logic in this phase — marketing, vault, competitors, reddit ship in later phases.

## Capabilities

### New Capabilities
- `pipeline-runtime`: declarative DAG of phases (claude -p calls) and gates (needs_review / deterministic / auto-pass) with file-based handoffs
- `task-queue`: persistent task store, cron-driven processor loop, and per-pipeline backpressure cap

### Modified Capabilities
<!-- none — greenfield -->

## Impact

- New repo: `/home/adrian/Developer/projects/command-center/` (already scaffolded directory; currently empty)
- Marketing-pipeline at `/home/adrian/Developer/projects/marketing-pipeline/` is **not** modified in this phase; it keeps running in parallel until phase 2 lands.
- New env var: `COMMAND_CENTER_ROOT` (defaults to repo root) for tasks/, signals/, drafts/, vault/ paths.
- New cron entry: `*/5 * * * * curl -X POST http://localhost:3001/api/cron` (port 3001 to avoid collision with marketing-pipeline on 3000 during transition).
