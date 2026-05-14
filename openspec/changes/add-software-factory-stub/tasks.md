## 1. Namespace and Route

- [ ] 1.1 Create `pipelines/software-factory/` directory
- [ ] 1.2 Build `/software-factory` SvelteKit route listing all software-factory pipelines (active and reserved) with their status
- [ ] 1.3 Wire route to read pipeline registry and filter by domain prefix

## 2. Daily-Housekeeping Pipeline

- [ ] 2.1 Implement `pipelines/software-factory/lib/clear-stale.ts`: scan tasks, filter `paused_backpressure` AND `updatedAt < now - 7d`, transition to `cleared_stale`
- [ ] 2.2 Append per-clear log entries to `logs/housekeeping/<YYYY-MM-DD>.log`
- [ ] 2.3 Author `pipelines/software-factory/pipeline.config.ts` registering `daily-housekeeping` (1 phase, auto_pass)
- [ ] 2.4 Wire into registry
- [ ] 2.5 Add 3 AM cron entry to `cron/cron.txt`

## 3. Reserved-Pipeline Documentation

- [ ] 3.1 Author `pipelines/software-factory/README.md` documenting the add-a-pipeline pattern
- [ ] 3.2 Enumerate reserved pipelines (spec-to-PR, test-triage, dep-bump) with one paragraph each on intended scope
- [ ] 3.3 Add reserved pipelines as `status: 'reserved'` entries in the registry so the dashboard lists them

## 4. Legacy Directory Symlink

- [ ] 4.1 `rm -rf` empty `~/Developer/projects/software-factory/` after confirming nothing inside
- [ ] 4.2 `ln -s` `~/Developer/projects/software-factory/` → `~/Developer/projects/command-center/pipelines/software-factory/`
- [ ] 4.3 Add a `README.md` inside the symlink target reminding readers this is the canonical location

## 5. Verification

- [ ] 5.1 Manually create a fake `paused_backpressure` task with `updatedAt` 10 days ago
- [ ] 5.2 Trigger `daily-housekeeping` manually via `POST /api/tasks`
- [ ] 5.3 Verify the task is transitioned to `cleared_stale` and a log line is appended
- [ ] 5.4 Visit `/software-factory` and verify the housekeeping pipeline appears as `active` with its last run timestamp
