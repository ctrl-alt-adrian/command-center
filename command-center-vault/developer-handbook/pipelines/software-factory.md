# Pipeline: `software-factory-housekeeping`

**Config:** `pipelines/software-factory/pipeline.config.ts:4`

## Purpose (domain)

The `software-factory` namespace is "the system maintaining itself and its own development workflow" (`README.md:3`). Its only **registered** inhabitant today is `software-factory-housekeeping`: a daily self-maintenance job that flips tasks stuck in `paused_backpressure` for more than 7 days to `cleared_stale` and appends a per-day housekeeping log. Pure file-ops, **no Claude**.

The point of this pipeline isn't the housekeeping job — it's **proof the multi-domain pattern works**. It's the first non-marketing-adjacent pipeline registered, demonstrating that a new domain is "drop a config + a prompt", not "rework the core".

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut | files read / written |
|---|---|---|---|---|
| `clear-stale` | auto_pass | `runClearStale()` — `listTasks()`, find `paused_backpressure` tasks with `updatedAt` older than 7 days, `updateTask(..., { status: "cleared_stale", error })`, append a line to `logs/housekeeping/<date>.log`. | none. | reads the whole task store; writes task status updates + `logs/housekeeping/<YYYY-MM-DD>.log`. |

### Data flow

- **Input source:** cron POST `/api/tasks` `{"pipelineId":"software-factory-housekeeping"}` — active in `cron/cron.txt` at `0 3 * * *`.
- **No external tools, no Claude.** It only touches the task store (`core/lib/tasks.ts`) and the logs dir.

```ts
// pipelines/software-factory/lib/clear-stale.ts:15-43 (abridged)
const tasks = await listTasks();
const cutoff = Date.now() - STALE_AFTER_DAYS * 86_400_000; // 7 days
const stale = tasks.filter((t) => {
  if (t.status !== "paused_backpressure") return false;
  const updated = Date.parse(t.updatedAt);
  return Number.isFinite(updated) && updated < cutoff;
});
for (const t of stale) {
  const ageDays = (Date.now() - Date.parse(t.updatedAt)) / 86_400_000;
  await updateTask(t.id, { status: "cleared_stale", error: `Cleared by daily-housekeeping after ${ageDays.toFixed(1)}d paused` });
  cleared.push({ taskId: t.id, pipelineId: t.pipelineId, updatedAt: t.updatedAt, ageDays: Math.round(ageDays * 10) / 10 });
}
// always append a log line, even on no-op
```

## Config knobs

- `backpressureCap: 5`, `perTickCap: 50` (pure file-ops — drains fast when many tasks pile up), `cronSchedule: "0 3 * * *"` (`pipeline.config.ts:10-13`). Phase timeout `30s`.
- `STALE_AFTER_DAYS = 7` (`lib/clear-stale.ts:7`).

## Slop rules

**None.**

## Key helper functions (`lib/`)

- `clear-stale.ts` — `runClearStale(): Promise<ClearStaleResult>` (`{ cleared[], scanned }`). Uses core `listTasks`, `updateTask`, `LOGS_DIR`, `nowIso`.

## Reserved pipelines (planning anchors — NOT registered)

`pipeline.config.ts:36-61` exports `RESERVED_SOFTWARE_FACTORY_PIPELINES`, an array of `ReservedPipeline` records. These are **not** passed to `registerPipeline` — they exist purely to be surfaced on `/software-factory` as `reserved` entries so the captain (or a future agent) can see what's planned:

| id | scope |
|---|---|
| `spec-to-pr` | Autonomous loop: pick the next pending OpenSpec change with `applyRequires` satisfied, implement its `tasks.md` on a fresh branch, run project checks, open a PR. Captain approves the PR via the normal review flow (not `/tasks`). |
| `test-triage` | Watch CI. When a flaky test fails twice in a row, open a `needs_review` task with the failure log + a Claude-suggested fix; leave the actual change to the captain. |
| `dep-bump` | Weekly: scan `package.json` / `go.mod` / requirements for safe (patch + minor) updates, bump + open a PR per package group; major bumps go to `needs_review`. |

These are documented intent, not commitments (`README.md:23`).

## Working-vs-stub verdict

**Working** for the one registered pipeline — it's small, deterministic, and exercised on every 3 AM tick. The three reserved pipelines are **intentionally unimplemented** stubs-as-documentation: real data structures (`ReservedPipeline[]`) feeding the dashboard, but zero runtime behavior. Their value is architectural — they validate that adding a new pipeline really is config + prompt + one `registry-bootstrap.ts` line.

## Cross-links

- Task statuses (`paused_backpressure`, `cleared_stale`): `core/lib/types.ts:3-11`, [../core/03-processor.md](../core/03-processor.md)
- Adding a pipeline (the pattern this proves): [00-index.md](00-index.md), [../best-practices/implementing-features.md](../best-practices/implementing-features.md)
