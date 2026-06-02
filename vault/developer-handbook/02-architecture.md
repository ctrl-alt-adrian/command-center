# 02 — Architecture

Command Center has three layers and a single on-disk data model. The whole
system runs as one Node process (the SvelteKit dashboard) plus an OS cron job
that pokes it once a minute.

## The three layers

```
┌──────────────────────────────────────────────────────────────┐
│ dashboard/   SvelteKit thin shell (pages + /api/* endpoints)  │
│              calls into core/lib/ directly                    │
├──────────────────────────────────────────────────────────────┤
│ pipelines/<name>/   one PipelineConfig + lib/ per domain      │
│              optional cli/ (prompts), slop-rules/             │
├──────────────────────────────────────────────────────────────┤
│ core/lib/    domain-agnostic runtime — NEVER modified to add  │
│              a domain                                          │
└──────────────────────────────────────────────────────────────┘
```

### Layer 1 — `core/lib/` (the runtime)

The runtime knows nothing about marketing, reddit, or any specific domain. It
knows only how to register pipelines, run phases, evaluate gates, store tasks,
shell out to `claude`, and read the vault. The files:

| File | Role | Handbook page |
|---|---|---|
| `types.ts` | `Task`, `GateType`, `PhaseConfig`, `PipelineConfig`, defaults | [core/01-data-model.md](core/01-data-model.md) |
| `processor.ts` | one tick: dispatch + gate eval + fan-out + caps | [core/03-processor.md](core/03-processor.md), [core/04-gates.md](core/04-gates.md) |
| `tasks.ts` | task store (JSON files + file lock) | [core/05-task-store.md](core/05-task-store.md) |
| `claude.ts` | `claude -p` wrapper + concurrency semaphore | [core/06-claude-wrapper.md](core/06-claude-wrapper.md) |
| `registry.ts` / `registry-bootstrap.ts` | pipeline registration | [core/07-registry-bootstrap.md](core/07-registry-bootstrap.md) |
| `slop.ts` | rule-pack engine (rules pluggable per pipeline) | [core/08-slop-engine.md](core/08-slop-engine.md) |
| `vault.ts` | MACHINE-framework KB reader | [core/09-vault-reader.md](core/09-vault-reader.md) |
| `paths.ts`, `io.ts`, `lock.ts`, `log.ts`, `utils.ts`, `cache.ts`, `pipelineState.ts` | utilities | [core/10-utilities.md](core/10-utilities.md) |

**The contract: you never edit `core/lib/` to add a domain.** From the README:

> 1. Create `pipelines/<name>/pipeline.config.ts` exporting a `PipelineConfig`.
> 2. Author the slash-command prompts in `pipelines/<name>/cli/`.
> 3. Register the pipeline in `core/lib/registry-bootstrap.ts`.
> 4. Add a cron entry to `cron/cron.txt` if it runs on a schedule.
>
> That's it — `core/lib/` is never modified.
>
> — `README.md:37`

(Adding a *capability* the runtime lacks — say a new `PhaseConfig` field — is the
exception: that's a deliberate runtime change, not a per-domain edit.)

### Layer 2 — `pipelines/<name>/`

One folder per domain. Each contains:

- `pipeline.config.ts` — the manifest: exports a `PipelineConfig` (its `id`,
  `phases`, and tuning knobs like `perTickCap`, `backpressureCap`,
  `fanOutBatchSize`). This is the file that gets imported and registered.
- `lib/` — the domain logic: the `run()` and `check()` implementations the
  phases reference.
- `cli/` (optional) — `claude` slash-command prompt files (`*.md`).
- `slop-rules/` (optional) — the rule pack for this pipeline's slop gate.

Some pipelines are nested one level deeper, e.g. `pipelines/rolenext/bug-resolver/`
and `pipelines/rolenext/job-apply/`. See [pipelines/00-index.md](pipelines/00-index.md).

### Layer 3 — `dashboard/`

A SvelteKit app (port 3001). It is intentionally thin: pages load data via
`+page.server.ts` and `/api/*` endpoints (`+server.ts`) that call directly into
`core/lib/`. There is no separate API server — the dashboard *is* the backend.
`hooks.server.ts` loads the root `.env` and registers all pipelines on boot. See
[dashboard/01-stack-and-bootstrap.md](dashboard/01-stack-and-bootstrap.md) and
[dashboard/04-full-stack-trace.md](dashboard/04-full-stack-trace.md).

## The on-disk data model

State is plain files under `COMMAND_CENTER_ROOT` (see
[core/10-utilities.md](core/10-utilities.md) for how paths resolve). There is no
database.

```
tasks/<id>/task.json            # the Task record (status, input, output, attempts)
tasks/<id>/<phaseId>/output.md  # each phase's serialized output
signals/<pipeline>/...          # external inputs scraped/fetched per pipeline
drafts/...                      # marketing/personal-brand content outputs
vault/...                       # MACHINE-framework knowledge base (atomic notes)
logs/
  processor-state.json          # last tick's counts + lastRunAt
  pipeline-state.json           # per-pipeline enabled/disabled kill switches
  processor-<date>.log          # JSONL event log, one file per day
  housekeeping/                 # software-factory housekeeping artifacts
```

`paths.ts` resolves the roots:

```ts
// core/lib/paths.ts
export const TASKS_DIR = path.join(COMMAND_CENTER_ROOT, "tasks");
export const SIGNALS_DIR = path.join(COMMAND_CENTER_ROOT, "signals");
export const DRAFTS_DIR = path.join(COMMAND_CENTER_ROOT, "drafts");
export const VAULT_ROOT = process.env.VAULT_ROOT ?? path.join(COMMAND_CENTER_ROOT, "vault");
export const LOGS_DIR = path.join(COMMAND_CENTER_ROOT, "logs");
export const PROCESSOR_STATE_FILE = path.join(LOGS_DIR, "processor-state.json");
```

A task's files:

```ts
// core/lib/paths.ts
export function taskDir(id: string)  { return path.join(TASKS_DIR, id); }
export function taskFile(id: string) { return path.join(taskDir(id), "task.json"); }
export function phaseDir(taskId, phaseId) { return path.join(taskDir(taskId), phaseId); }
```

The event log is JSONL, one line per event, one file per day:

```ts
// core/lib/log.ts
const day = nowIso().slice(0, 10);
const line = JSON.stringify({ ts: nowIso(), kind, ...payload }) + "\n";
await fs.appendFile(path.join(LOGS_DIR, `processor-${day}.log`), line, "utf-8");
```

Because state is files, concurrent writes are serialized with a file lock —
`core/lib/lock.ts`, used by the task store. See
[core/05-task-store.md](core/05-task-store.md).

## The request / heartbeat flow

Nothing runs on its own. An OS cron job curls the dashboard once a minute, and
that single request runs one processor tick:

```
                 every minute
   OS cron  ───────────────────▶  POST http://localhost:3001/api/cron
                                          │
                                          ▼
                                   runProcessor()   (core/lib/processor.ts)
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                            ▼                           ▼
     resume paused_backpressure   dispatch pending (FIFO,      run phases in
     tasks if cap cleared         honoring per-tick caps)      parallel; eval gates
                                          │
                                          ▼
                          write task.json + phase output.md + logs
```

The endpoint is trivially thin — it just calls the runtime:

```ts
// dashboard/src/routes/api/cron/+server.ts
import { runProcessor } from "../../../../../core/lib/processor.ts";

export async function POST() {
  const result = await runProcessor();
  return json(result);
}
```

Daily/weekly cron lines are different: they `POST /api/tasks {pipelineId}` to
**enqueue** a fresh top-of-pipeline task, which the every-minute heartbeat then
advances. The complete cron decode is in
[operations/cron-and-scheduling.md](operations/cron-and-scheduling.md).

## Directory map (repo root)

```
core/lib/            domain-agnostic runtime (Layer 1)
pipelines/<name>/    one PipelineConfig + lib/ per domain (Layer 2)
dashboard/           SvelteKit app, port 3001 (Layer 3)
cli/                 slash-command prompts shared across pipelines
cron/                cron.txt + fetch-signals.sh
tasks/               task store (one dir per task)
signals/             external signals (per-pipeline subdirs)
drafts/              marketing / personal-brand content outputs
vault/               MACHINE-framework KB
logs/                processor-state.json, pipeline-state.json, processor-<date>.log, housekeeping/
setup.sh             idempotent installer
.env.example         documented config (see operations/configuration.md)
```

## Where to go next

- The runtime, file by file: [core/01-data-model.md](core/01-data-model.md) onward.
- The dashboard layer: [dashboard/01-stack-and-bootstrap.md](dashboard/01-stack-and-bootstrap.md).
- One request traced end to end: [dashboard/04-full-stack-trace.md](dashboard/04-full-stack-trace.md).
- Run it: [03-getting-started.md](03-getting-started.md).
