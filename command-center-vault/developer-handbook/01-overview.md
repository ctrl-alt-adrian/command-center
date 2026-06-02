# 01 — Overview: What Command Center Is

Command Center is a single hub that runs many automation **pipelines** —
marketing content, a software factory, market-signal mining, and more — on top
of one shared, domain-agnostic runtime. From the project README:

> Single hub for marketing, software factory, and future domains. Built on one
> primitive: a DAG of **phases** (`claude -p` calls) alternating with **gates**
> (`needs_review` / `deterministic` / `auto_pass`).
>
> — `README.md:3`

## The core primitive

Everything in the system reduces to one shape:

- A **pipeline** is an ordered list of **phases** (a DAG — in practice a linear
  chain, with fan-out branching it into many parallel tasks).
- Each **phase** has a `run()` step (the work — usually a `claude -p` call, but
  it can be any TypeScript: a yt-dlp scrape, a file move, an HTTP fetch) and a
  **gate** that decides what happens after the work finishes.
- A **task** is a single unit flowing through one pipeline. It carries its
  `pipelineId`, current `phaseId`, `status`, `input`, and accumulated `output`.

The phase and gate types live in `core/lib/types.ts`:

```ts
// core/lib/types.ts:1
export type GateType = "needs_review" | "deterministic" | "auto_pass";
```

```ts
// core/lib/types.ts:22
export interface PhaseConfig {
  id: string;
  slashCommand?: string;
  gateType: GateType;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  check?: (task: Task) => Promise<GateCheckResult>;
  run?: (task: Task, ctx: PhaseContext) => Promise<PhaseOutput>;
  fanOut?: (task: Task) => Promise<Array<Record<string, unknown>>>;
  onExhausted?: (task: Task, reason: string) => Promise<void>;
}
```

### The three gate types

A gate runs **after** a phase's `run()` succeeds and decides the task's fate.
Full mechanics are in [core/04-gates.md](core/04-gates.md); the summary:

| Gate | Behavior |
|---|---|
| `auto_pass` | Advance immediately to the next phase. No human, no check. |
| `deterministic` | Run a `check(task)` predicate. On pass, advance. On fail, rewind to the previous phase and retry (with feedback) up to `retryPolicy.maxAttempts`; on exhaustion, park as `needs_review` with a `gateFailReason`. |
| `needs_review` | Stop. The task sits as `needs_review` until the **captain** approves (advance) or rejects (fail) it from the dashboard. |

### The captain

The **captain** is the human operator. The system is deliberately not fully
autonomous: any phase that produces something publishable or irreversible ends
in a `needs_review` gate, so a human eyeballs it before it advances. The captain
works almost entirely through the dashboard at `http://localhost:3001/tasks` —
approving, rejecting, re-running gates, resuming paused batches, and toggling
pipelines on and off. See [core/02-task-lifecycle.md](core/02-task-lifecycle.md)
for what each captain action does.

## One runtime, many pipelines, one dashboard

Command Center is three layers (detailed in [02-architecture.md](02-architecture.md)):

- **`core/lib/`** — the runtime. The processor, task store, gate engine, claude
  wrapper, registry, slop engine, vault reader. **Never modified to add a
  domain.**
- **`pipelines/<name>/`** — one folder per domain. Each exports a
  `PipelineConfig` and its own `lib/` (plus optional `cli/` prompt files and
  `slop-rules/`).
- **`dashboard/`** — a SvelteKit thin shell: file-based pages and a set of
  `/api/*` endpoints that call straight into `core/lib/`.

## The heartbeat

There is no long-running daemon. The flow is:

```
OS cron  ──every minute──▶  POST /api/cron  ──▶  runProcessor()  ──▶  one tick
```

`runProcessor()` does the work of one tick: resume what it can, dispatch pending
tasks (subject to caps), run their phases in parallel, evaluate gates, and write
the results back to disk. Then it returns. Nothing runs until the next minute's
curl. See [02-architecture.md](02-architecture.md) and
[core/03-processor.md](core/03-processor.md).

## The 9 registered pipelines

Pipelines are registered in `core/lib/registry-bootstrap.ts`:

```ts
// core/lib/registry-bootstrap.ts:14
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

That's 9 registered `PipelineConfig`s (the `reddit-pmf` import brings in two —
`redditPmfPipeline` and `redditPmfMetricsPipeline`). Status as mapped:

| Pipeline | Status | Notes |
|---|---|---|
| `marketing` | working | One known no-op: `markUsedForContent` for vault ids is a stub. See [pipelines/marketing.md](pipelines/marketing.md). |
| `vault-nuggets` | working | Extracts atomic notes into the vault. See [pipelines/vault-nuggets.md](pipelines/vault-nuggets.md). |
| `competitors` | working | Scrapes via `yt-dlp`. See [pipelines/competitors.md](pipelines/competitors.md). |
| `reddit-pmf` | working (partial) | Scrape + extract work; the Vercel deploy / `vercel-push` step is **not implemented** — dry-run only. See [pipelines/reddit-pmf.md](pipelines/reddit-pmf.md). |
| `reddit-pmf-metrics` | **STUB** | Emits `ctr: null` / `signups: null`. Wired to cron but produces no real metrics yet. |
| `software-factory-housekeeping` | working | Daily file housekeeping. See [pipelines/software-factory.md](pipelines/software-factory.md). |
| `rolenext-bug-resolver` | working (v1) | Investigate-only; does not yet open PRs. See [pipelines/rolenext-bug-resolver.md](pipelines/rolenext-bug-resolver.md). |
| `rolenext-job-apply` | working | Needs `ROLENEXT_JWT`. No cron entry — trigger manually. See [pipelines/rolenext-job-apply.md](pipelines/rolenext-job-apply.md). |
| `personal-brand` | working | Per-platform content + drafts editor. No cron entry. See [pipelines/personal-brand.md](pipelines/personal-brand.md). |

> There may also be a `test-pipeline` validator registered in the source
> elsewhere; the 9 above are the ones wired in `registry-bootstrap.ts`. Always
> confirm against the live file.

## Where to go next

- The full layout and data model: [02-architecture.md](02-architecture.md).
- Get it running: [03-getting-started.md](03-getting-started.md).
- The runtime internals: [core/03-processor.md](core/03-processor.md),
  [core/04-gates.md](core/04-gates.md).
- Every term defined: [glossary.md](glossary.md).
