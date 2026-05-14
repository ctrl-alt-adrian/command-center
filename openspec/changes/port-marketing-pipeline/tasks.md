## 1. Pipeline Registration

- [ ] 1.1 Create `pipelines/marketing/pipeline.config.ts` declaring the four phases, gate types, retry policy, cap, and 11 AM cron
- [ ] 1.2 Wire the pipeline into the central registry so the dashboard auto-loads it at startup
- [ ] 1.3 Define marketing-specific constants (`PLATFORMS`, scoring weights, dedup threshold) in `pipelines/marketing/lib/constants.ts`

## 2. Port Discovery Phase

- [ ] 2.1 Copy `cli/kb-scanner.md` and the discovery orchestration prompt from marketing-pipeline into `pipelines/marketing/cli/`
- [ ] 2.2 Port `generate.ts` discovery logic into `pipelines/marketing/lib/discovery.ts` calling core's claude wrapper
- [ ] 2.3 Port `scoring.ts` weighted scoring into `pipelines/marketing/lib/scoring.ts`
- [ ] 2.4 Port `dedup.ts` Jaccard similarity into `pipelines/marketing/lib/dedup.ts`
- [ ] 2.5 Verify: a manual `POST /api/tasks` to the marketing pipeline produces a `candidates.json` matching the shape marketing-pipeline emits today

## 3. Port Generate Phase

- [ ] 3.1 Copy `cli/write-post-shared.md` and `cli/write-post-{platform}.md` for all six platforms
- [ ] 3.2 Implement parallel platform fan-out: spawn one claude subagent per enabled platform, await all
- [ ] 3.3 Write per-platform `draft.md`, `meta.json`, `status.json` under the task output directory
- [ ] 3.4 Verify: an approved candidate produces six platform drafts side-by-side

## 4. Port Slop Engine + Gate

- [ ] 4.1 Copy `slop-rules/*.yaml` from marketing-pipeline into `pipelines/marketing/slop-rules/`
- [ ] 4.2 Register the rule pack with core's slop engine at pipeline startup
- [ ] 4.3 Wire slop-check as a deterministic gate with `check` running `runRules` over every platform draft
- [ ] 4.4 Implement violation feedback: on fail, append violations to the generate phase's prompt input file
- [ ] 4.5 Verify retry semantics: a draft that fails once retries with feedback; after 3 failures it routes to needs_review

## 5. Port Drafts Editor

- [ ] 5.1 Build `/marketing/drafts` list route showing all drafts with platform, status, created
- [ ] 5.2 Build per-draft editor route with markdown editor + slop panel
- [ ] 5.3 Wire "Refine" button to claude refinement endpoint
- [ ] 5.4 Wire per-platform "Regenerate" button to single-platform subagent re-invocation
- [ ] 5.5 Wire slop re-check button

## 6. Port Review Bin

- [ ] 6.1 Build review-bin component on `/tasks` filtered to marketing review phase tasks
- [ ] 6.2 Implement approve action: mark drafts approved, set KB `usedForContent: true`, complete task
- [ ] 6.3 Implement reject action: revert task to generate with rejection note in prompt input

## 7. Cron Migration

- [ ] 7.1 Add `cron/fetch-signals.sh` (10 AM) and `cron/daily-discovery.sh` (11 AM) entries to `cron/cron.txt`
- [ ] 7.2 Update `setup.sh` to install them and remove marketing-pipeline's old entries from crontab
- [ ] 7.3 Verify: cron entries are present, marketing-pipeline's old entries are gone

## 8. Drafts Migration

- [ ] 8.1 Run an end-to-end cycle on command-center port 3001; confirm parity with marketing-pipeline output
- [ ] 8.2 Copy existing `marketing-pipeline/drafts/` into `command-center/drafts/` (atomic copy, source preserved)
- [ ] 8.3 Spot-check: drafts editor opens copied drafts correctly

## 9. Archive Marketing-Pipeline

- [ ] 9.1 Add a deprecation note to `marketing-pipeline/README.md` pointing to command-center
- [ ] 9.2 Stop marketing-pipeline's dashboard process; keep the directory intact for one month
- [ ] 9.3 Update `setup.sh` in marketing-pipeline to print a deprecation message and exit
