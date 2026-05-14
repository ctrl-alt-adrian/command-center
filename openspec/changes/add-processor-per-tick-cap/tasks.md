## 1. Core changes

- [ ] 1.1 Add `PROCESSOR_PER_TICK_CAP` to `core/lib/paths.ts` (or a new `core/lib/config.ts`) as a number constant pulled from env with default 3
- [ ] 1.2 Add `perTickCap?: number` to `PipelineConfig` in `core/lib/types.ts`
- [ ] 1.3 Modify `core/lib/processor.ts` `runProcessor()`:
  - Sort `listTasks()` pending entries by `createdAt` ascending
  - Track per-pipeline counts; stop dispatching to a pipeline when its `perTickCap` (or global) is reached
  - Track total dispatched + remaining; return `deferred: number` in `ProcessorResult`
- [ ] 1.4 `ProcessorResult` type gains `deferred: number`

## 2. Pipeline overrides

- [ ] 2.1 `pipelines/software-factory/pipeline.config.ts` declares `perTickCap: 50` (housekeeping is pure file ops, no claude)
- [ ] 2.2 `pipelines/competitors/pipeline.config.ts` declares `perTickCap: 5` (yt-dlp scrape per task is slow but cheap)
- [ ] 2.3 Document the default + per-pipeline overrides in the root `README.md`

## 3. Dashboard surface

- [ ] 3.1 `/tasks/+page.server.ts` exposes the most recent processor result's `deferred` count (read from last log entry or processor in-memory state)
- [ ] 3.2 `/tasks/+page.svelte` shows a banner "N tasks deferred to next tick" when applicable
- [ ] 3.3 Add `/api/cron` response shape to the OpenAPI-equivalent comment block (or `README.md` API section)

## 4. .env + setup

- [ ] 4.1 `.env.example` adds `PROCESSOR_PER_TICK_CAP=3` with a comment
- [ ] 4.2 `README.md` documents the tunable

## 5. Verification

- [ ] 5.1 Unit-style: create 10 test-pipeline tasks (the existing pipeline declares no override), POST /api/cron once, observe 3 processed + 7 deferred
- [ ] 5.2 POST /api/cron 3 more times, observe queue drains 3-3-1 = 7 more
- [ ] 5.3 Repeat with 10 software-factory-housekeeping tasks, observe all 10 drain in one tick (perTickCap override)
- [ ] 5.4 Confirm backpressure-resume continues to work: cap a pipeline at 5 needs_review, drop a 6th, approve one, confirm the 6th resumes regardless of per-tick cap
