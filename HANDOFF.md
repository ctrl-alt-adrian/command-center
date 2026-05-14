# Handoff — Command Center

**Last context window snapshot:** end of phase-6 + cron install + audit + 5 OpenSpec fix proposals drafted. Marketing fan-out fix shipped (`2793f31`); marketing review/reject/slop-retry still broken per audit.

Pick this up cold. The audit identified specific bugs; fix proposals are ready; start with marketing because the original `marketing-pipeline` repo at `../marketing-pipeline/` is a known-working reference for any behavior you can't infer from spec alone.

---

## Where things are

### Repo: `/home/adrian/Developer/projects/command-center/`

Git log (top → bottom = newest → oldest):
```
2793f31 fix: marketing discovery → generate handoff via PhaseConfig.fanOut
a27be74 add: install pipeline crons + clear-failed across all domains
190b67c phase 6: software-factory namespace + daily-housekeeping
f8772ac phase 5: reddit-pmf pipeline (zero-gate market signal)
bea7635 phase 4: competitors pipeline + /competitors dashboard
f730848 phase 3: vault layout + nuggets pipeline
95b71a6 init: command-center hub with phase 1 + phase 2
```

### Registered pipelines (7)
- `test-pipeline` ✅ — phase-1 validator, can delete later
- `marketing` 🟡 — fanOut works (just fixed); slop-retry / review approve+reject / drafts-editor still broken
- `vault-nuggets` 🟡 — code clean, never run against real claude
- `competitors` ✅ — validated end-to-end via yt-dlp; produced `signals/competitors/2026-05-14.json`
- `reddit-pmf` 🟡 — scrape+extract work; deploy is dry-run only (Vercel push documented-but-unimplemented)
- `reddit-pmf-metrics` ❌ — stub, writes null CTR/signups
- `software-factory-housekeeping` ✅ — validated; cleared 0/1 today's run

### System cron (installed via `setup.sh` cron-install step)
| Schedule | Pipeline | Status |
|---|---|---|
| `*/5 * * * *` | command-center processor | active |
| `0 9 * * *` | vault-nuggets | active |
| `0 10 * * *` | competitors | active |
| `0 3 * * *` | software-factory-housekeeping | active |
| `0 8 * * 1` | reddit-pmf | active |
| `0 17 * * 5` | reddit-pmf-metrics | active (writes stub) |
| marketing fetch-signals / discovery | — | **NOT installed** (still commented in `cron/cron.txt`; `marketing-pipeline` at `:3000` still owns those slots) |

Backup of pre-install crontab: `~/.cache/crontab/crontab.bak`

### Dashboard
- Path: `dashboard/`
- Start: `cd dashboard && npm run dev` (port 3001)
- Stack: SvelteKit 2.57, Svelte 5 runes, Tailwind 4, Node 25.9 (mise), TypeScript 6
- Type-check: `npm run check` (last seen: 0 errors, 0 warnings across ~407 files)

### Key paths
- `core/lib/` — domain-agnostic runtime (types, registry, tasks, processor, claude wrapper, slop engine, vault reader, lock)
- `pipelines/<name>/` — one folder per domain, each with `pipeline.config.ts` + `lib/` + (optional) `cli/`, `slop-rules/`, `landing-template/`
- `pipelines/<name>/pipeline.config.ts` is the manifest that gets registered in `core/lib/registry-bootstrap.ts`
- `openspec/changes/` — all change proposals (6 phase proposals + 5 fix proposals drafted)
- `openspec/specs/` — empty until proposals get archived after implementation

---

## Audit summary (what works / what doesn't)

Full audit ran end-of-session. **Marketing-blocking bugs in priority order:**

1. **Processor processes all pending in one tick** (`core/lib/processor.ts:35-53`). 53-task fan-out from marketing approval = one /api/cron POST blocks for hours. Fix: `add-processor-per-tick-cap`.
2. **Slop-check retry can't reach generate** (`core/lib/processor.ts:165-173`). Re-runs slop-check against same drafts; guaranteed to fail same way. Marketing-pipeline rolls back to generate with feedback. Fix: `fix-gate-retry-rollback`.
3. **Review approve doesn't mark KB `usedForContent: true`.** Same candidates resurface every discovery. Fix: `fix-marketing-review-side-effects`.
4. **Reject is terminal.** Marketing-pipeline reroutes to generate with feedback. Fix: same proposal as #3.
5. **No candidate picker.** Discovery approve = "53 candidates or nothing". Fix: `add-candidate-picker`.
6. **Drafts editor read-only.** No refine, regenerate, slop re-check, status dropdown. Fix: `port-drafts-editor-affordances`.

**Non-marketing issues** (deferred; see full audit list in session transcript):
- Cron silently fails when dashboard is down (no alarm)
- Generate retry doesn't carry slop violations (dead `slopFeedback` field reference — gets cleaned up by `fix-gate-retry-rollback`)
- Competitors yt-dlp loses 5/15 channels silently (data quality, not pipeline bug)
- Reddit deploy Vercel push not wired (intentional; phase-5 deferred)
- Reddit metrics stub
- Dashboard PATH inheritance for claude binary

---

## The 5 fix proposals (in `openspec/changes/`)

All five validate cleanly via `openspec validate <name>`. Implement in this order — later ones build on earlier infrastructure.

### Order 1 — `add-processor-per-tick-cap`
- **Why first:** Without this, every subsequent fix that creates fan-out tasks (candidate picker, gate-rollback) makes the runaway-tick problem worse.
- **Scope:** Add `perTickCap` to PipelineConfig (default 3), modify processor to FIFO-slice pending tasks, return `deferred` count.
- **Touches:** `core/lib/types.ts`, `core/lib/processor.ts`, all pipeline configs that want overrides (software-factory → 50, competitors → 5), `.env.example`, `/tasks` banner.
- **Effort:** ~1-2 hours.
- **Validation:** Create 10 test-pipeline tasks → /api/cron → see 3 processed + 7 deferred. Iterate.

### Order 2 — `fix-gate-retry-rollback`
- **Why second:** Marketing slop-retry is broken today; this also kills the dead `slopFeedback` field.
- **Scope:** Add `retryFromPhase` to PhaseConfig + `gateRetryFeedback` to task input. Validate at registry time (must point earlier). Marketing slop-check declares `retryFromPhase: "generate"`; generate reads `gateRetryFeedback`.
- **Touches:** `core/lib/types.ts`, `core/lib/registry.ts` (registration validator), `core/lib/processor.ts` (gate-fail branch), `pipelines/marketing/pipeline.config.ts`.
- **Effort:** ~2 hours.
- **Validation:** Manually plant a banned word in a draft.md, fire slop-check, observe rollback → fresh generate → new draft.

### Order 3 — `fix-marketing-review-side-effects`
- **Why next:** Without this, every approved review re-surfaces the same candidate next time. Also adds the generic `onApprove`/`onReject` hooks that future domains may use.
- **Scope:** Add `onApprove`/`onReject` hooks to PhaseConfig (fire AFTER transition, log-don't-fail on hook errors). Marketing review declares both — approve marks KB used; reject reroutes to fresh generate with `rejectFeedback`.
- **Touches:** `core/lib/types.ts`, `core/lib/processor.ts` (approveTask + rejectTask), `pipelines/marketing/pipeline.config.ts`.
- **Effort:** ~1-2 hours.
- **Validation:** Approve a review task → check KB frontmatter flips to `usedForContent: true`. Reject a different task with a reason → see fresh generate task with `rejectFeedback` populated.

### Order 4 — `add-candidate-picker`
- **Why next:** Without this, every discovery approval still spends $2-5 in tokens on 53 candidates. Per-tick cap (order 1) makes this safer but doesn't eliminate the spend.
- **Scope:** Detect needs_review tasks with `output.candidates` and render a picker UI. `POST /api/tasks/<id>/approve` accepts optional `selectedCandidateIds`. Marketing discovery's fanOut filters by selection. Selection persists via `POST /api/tasks/<id>/selection`.
- **Touches:** `dashboard/src/routes/api/tasks/[id]/approve/+server.ts`, new `/api/tasks/[id]/selection/+server.ts`, `dashboard/src/lib/CandidatePicker.svelte`, `dashboard/src/routes/tasks/[id]/+page.svelte`, `pipelines/marketing/pipeline.config.ts` (discovery fanOut filter).
- **Effort:** ~3 hours.
- **Validation:** Run discovery → /tasks/<id> → picker renders → select 3 → approve → 3 generate tasks created.

### Order 5 — `port-drafts-editor-affordances`
- **Why last:** UX-critical for daily use but doesn't block automation. Builds on all the above.
- **Scope:** Four API endpoints (refine / regenerate / slop-check / status) + UI controls + a new `refine-post.md` prompt + `generateSinglePlatform` helper refactor.
- **Touches:** `pipelines/marketing/lib/generate.ts` (refactor), `pipelines/marketing/cli/refine-post.md` (new), 4× new API files under `dashboard/src/routes/api/marketing/drafts/[date]/`, `dashboard/src/routes/marketing/drafts/[slug]/+page.svelte`.
- **Effort:** ~3-4 hours.
- **Validation:** Pull a sample draft from marketing-pipeline, drop into `drafts/`, run each action.

---

## How to pick this up

```bash
cd /home/adrian/Developer/projects/command-center

# Verify current state
git log --oneline
cd dashboard && npm run check   # expect 0 errors, 0 warnings
curl -s http://localhost:3001/   # dashboard up?

# See the proposals
openspec list
openspec show add-processor-per-tick-cap   # proposal.md
cat openspec/changes/add-processor-per-tick-cap/design.md
cat openspec/changes/add-processor-per-tick-cap/tasks.md

# Start phase: pick first proposal
# Mark each tasks.md item as you go
```

The dashboard is probably still running in the background. If not: `cd dashboard && npm run dev`.

---

## Reference: marketing-pipeline (the source of truth)

When you're unsure how a marketing behavior should work, check `../marketing-pipeline/`:

- `dashboard/src/lib/workers.ts` — the original processor logic; shows how discover→generate fanOut, slop-retry, and approve flows behave
- `dashboard/src/lib/generate.ts` — the per-platform generation; marketing-pipeline's version is what command-center ported
- `dashboard/src/routes/drafts/[slug]/` — the original drafts editor with refine/regenerate/slop-check buttons
- `cli/write-post-*.md` — already copied into `pipelines/marketing/cli/`

The original is still running on `:3000` for production daily-work. Don't break it. The cutover happens after these fixes ship and the captain confirms parity.

---

## Open captain decisions (resolve as needed)

1. **Cut over marketing cron from :3000 to command-center :3001?** Today both could fight for the 10/11 AM slots. Leave manual until fixes land.
2. **Wire real Vercel deploy for reddit-pmf?** Documented in `pipelines/reddit-pmf/landing-template/README.md`. Captain hasn't created the landing-template repo or Vercel project yet.
3. **Real claude validation of vault-nuggets?** Spending ~$0.10-0.50 in Haiku tokens to scan the existing 93 session entries. Worth doing once before depending on the 9 AM cron.

---

## Don'ts (rules absorbed across this build)

- **No Claude attribution in commits or PRs.** Captain ruled global. `Co-Authored-By: Claude` and `🤖 Generated with Claude Code` are banned.
- **Plan-before-execute for non-trivial work.** Surface the plan, wait for explicit approval. Multi-task work isn't an exception.
- **Root-cause, don't guess.** Look at the actual code path. Compare with marketing-pipeline when behavior is unclear.
- **`/bin/zsh` doesn't word-split unquoted vars.** Use `${=VAR}` or arrays. Bit me once already.
- **`openspec init --tools claude`** is already done; don't re-init.
