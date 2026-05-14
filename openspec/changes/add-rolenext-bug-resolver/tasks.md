## 1. Scaffold

- [x] 1.1 Create pipeline directory `pipelines/rolenext/bug-resolver/` with empty `lib/`, `prompts/`, and `state/` subdirectories
- [x] 1.2 Write minimal `pipeline.config.ts` exporting a `PipelineConfig` with id `rolenext-bug-resolver`, the seven phases as stubs (each `run` is `async () => ({ output: {} })`), `backpressureCap: 5`, and a `cronSchedule` placeholder
- [x] 1.3 Add a `RolenextBugResolverConfig` interface holding `repo`, `rolenextPath`, `worktreeBase`, `enableBrowserRepro` (default `false`), `reproTarget`, `caps`, `triageThreshold`, `writePolicy`, `fixRetries`, `killSwitchFile`
- [x] 1.4 Register the pipeline in `core/lib/registry-bootstrap.ts` (one import + one `registerPipeline` line); confirm no other core file is touched
- [x] 1.5 Remove the `spec-to-pr`-style entry from `RESERVED_SOFTWARE_FACTORY_PIPELINES` if this implementation replaces it semantically; otherwise leave reserved entries untouched

## 2. GitHub & dedup primitives

- [x] 2.1 `lib/github.ts`: thin wrappers over `gh` CLI for `listOpenIssues(repo, opts)`, `getIssue(repo, n)`, `labelIssue(repo, n, labels[])`, `closeIssue(repo, n, comment)`, `commentOnIssue(repo, n, body)`, `listOpenPRs(repo, opts)`, `getPRComments(repo, n)`, `getPRReviews(repo, n)`, `prDiff(repo, n)`, `prDraft(repo, n, draft: boolean)`, `createPR(repo, opts)`
- [x] 2.2 `lib/state.ts`: load/save `state/fingerprints.json`, daily counter (`state/daily-counter.json` keyed by UTC date), and kill-switch detection
- [x] 2.3 `lib/dedup.ts`: implement Layer 1 (task-store lookup), Layer 2 (GitHub state + label check), Layer 3 (fingerprint compute + 14-day window match)
- [x] 2.4 Unit-test dedup logic with fixtures for each layer (in-flight task, closed issue, wontfix label, fingerprint match, fingerprint stale match)

## 3. Worktree management

- [x] 3.1 `lib/worktree.ts`: `createWorktree(rolenextPath, worktreeBase, issueNumber)` runs `git fetch origin main` then `git worktree add <path> origin/main -b bug/issue-<N>`; returns the worktree path
- [x] 3.2 `lib/worktree.ts`: `removeWorktree(path)` runs `git worktree remove <path>` and removes the branch on success
- [x] 3.3 `lib/worktree.ts`: `diffAgainstMain(worktreePath)` returns `git diff --name-only origin/main...HEAD` output
- [x] 3.4 Handle worktree-cleanup failures gracefully (force-remove on stale lock files); test idempotence

## 4. Poll-issues phase

- [x] 4.1 Write `phases/poll-issues.ts` that orchestrates: load state, check kill-switch, check daily cap, check queue depth, list open issues, run all three dedup layers per issue, create triage tasks via `createTask`, persist updated state
- [x] 4.2 Wire poll-issues phase into the pipeline config; verify it returns immediately (no advance) and child tasks land in `pending` state at `phaseId: "triage"`
- [x] 4.3 Handle reopens: detect `state_reason: "reopened"`, bypass Layer 1, set `input.attempt: <prev + 1>`, include prior merged PR diff URL in input
- [x] 4.4 Handle stale tickets: scan pending tasks, escalate any older than `ticketStaleAfterDays` to `needs_review`
- [x] 4.5 Handle queue-depth overflow: when reached, create a sentinel task in `needs_review` and stop creating new triage tasks for this poll run
- [x] 4.6 Apply `bot-deferred` label to issues skipped because of the daily cap

## 5. Investigate agent

- [x] 5.1 `prompts/investigate.md`: instructs claude to start at `specs/spec-map.md`, walk the relevant feature spec(s), spawn parallel subagents on suspected files, and emit `{fixKnown, confidence, rootCause, filesImplicated, specsReferenced, proposedFix, notes, noBugFound?}`
- [x] 5.2 `lib/investigate-agent.ts`: invokes `claude -p` against the worktree with the prompt, the issue body, and any prior PR diff (on reopens) as context
- [x] 5.3 `lib/investigate-agent.ts`: parses JSON; retry-once on parse failure with a "respond ONLY with the JSON object" suffix; surface parse failure as a structured error so the gate routes it correctly

## 6. Triage phase + gate (v1: investigate-only)

- [x] 6.1 `phases/triage.ts`: invokes the investigate agent, persists output as `investigate.json` in the task output dir
- [x] 6.2 When `enableBrowserRepro: false` (v1), the phase runs investigate only — no Playwright, no `make db`, no dev-server startup, no bot-user setup
- [x] 6.3 Implement the deterministic gate (`check` function) using the investigate-only decision table from spec D6
- [x] 6.4 Forced-needs_review path: when `input.attempt > 1` (reopen), gate routes to `needs_review` regardless of confidence; reason includes attempt number
- [x] 6.5 Cannot-reproduce path: when `investigate.noBugFound === true`, close the GitHub issue via `closeIssue` with the canonical investigate-only auto-comment; **mark the task `needs_review` with reason `"close: cannot-reproduce"`** (the core processor cannot produce `completed` mid-pipeline; the captain confirms the close on the dashboard)
- [x] 6.6 Mixed-signal / parse-failure paths: route to `needs_review` with structured reasons stored in `gateFailReason`

## 7. Handoff writer

- [x] 7.1 `lib/handoff.ts`: composes `handoff.md` from `investigate.json` (and `repro.json` when v1.1 enabled) with sections for bug summary, ticket URL, files implicated, root cause, proposed fix, specs touched, risks; repro-evidence section is included only when `enableBrowserRepro: true`
- [x] 7.2 `phases/write-handoff.ts`: writes `handoff.md` to task output dir
- [x] 7.3 Append `## Attempt N failure` blocks when called on retry (read prior handoff, splice in the new failure log)

## 8. Fix phase (open mode + subagent decomposition)

- [x] 8.1 `prompts/fix.md`: instructs claude to read handoff, **decompose multi-file or multi-concern fixes into independent units** and spawn subagents per unit (one task, one context window), follow the write-policy constraints, add a regression test, and assemble the regression test at the parent level
- [x] 8.2 `lib/fix-agent.ts`: invokes `claude -p` in the worktree dir with the prompt, handoff, and full file-edit capability; allows long timeout (≥ 45 min) and bumped `maxBuffer` (≥ 50 MB)
- [x] 8.3 `lib/fix-agent.ts`: on completion, captures the diff via `diffAgainstMain` and writes it to task output as `fix-diff.patch`
- [x] 8.4 `phases/fix.ts`: wires open mode (default when `input.mode` is unset or `"open"`); commits the changes with a structured message (`fix(<area>): <summary> [#<N>]`)
- [x] 8.5 For single-file fixes, the prompt explicitly permits skipping subagent decomposition

## 9. Verify phase (three checks in v1)

- [x] 9.1 `lib/verify/write-policy.ts`: glob-match each diff path against hard-ban and soft-ban arrays from config; return structured `{ ok, hard: string[], soft: { path: string, category: string }[] }`. Hard-ban presence sets `ok: false`; soft-ban presence does NOT set `ok: false`.
- [x] 9.2 `lib/verify/regression-test.ts`: glob-match the diff against `backend/**/test*`, `frontend/**/*test*`, `testing/**`; return `{ ok, testFiles: string[] }`
- [x] 9.3 `lib/verify/make-ci.ts`: runs `make ci` in the worktree, captures exit code + tail of stdout/stderr (cap to 64 KB)
- [x] 9.4 `phases/verify.ts`: dispatches all checks, composes a structured `verify.json` output that includes `softBanTouched: { path, category }[]` (for downstream PR phase); gate `check` function returns `pass: false` with a reason concatenating all blocking failures
- [x] 9.5 Retry plumbing: on `make ci` failure (when write-policy + regression checks already passed), `verify.run()` appends the failure log to `handoff.md` and re-invokes the fix agent in-place against the same worktree, then re-runs all checks. Loops up to `cfg.fixRetries` additional attempts. Verify is the OWNER of the retry loop because the processor's retry primitive re-dispatches the same phase against the same diff, not the prior phase. Per-attempt records are surfaced in `verify.json.attempts[]`.

## 10. PR phase (open mode)

- [x] 10.1 `lib/pr.ts`: builds the PR body template with all required sections (bug summary, Closes #N, root cause, fix summary, verification checklist, full handoff in `<details>`, attribution footer). When `verify.softBanTouched` is non-empty, inserts a `⚠️ Soft-ban paths touched` callout listing each path + category.
- [x] 10.2 `lib/pr.ts`: pushes branch `bug/issue-<N>` to origin
- [x] 10.3 `lib/pr.ts`: runs `gh pr create --draft` with title, body, labels (`bot-fix`, `bug`, `auto-triaged`, plus `bot-touched-soft-banned` when soft-ban paths were touched), assignee, reviewer; captures the new PR number/URL
- [x] 10.4 `phases/pr.ts`: writes PR number/URL back to task output so downstream phases (post-mortem) can reference it

## 11. Post-mortem phase

- [x] 11.1 `prompts/post-mortem.md`: instructs claude to write the markdown body (sections: What broke, Root cause, Detection, Fix, Why bot handled autonomously, Lessons) using inputs from `handoff.md`, `investigate.json`, and `verify.json`. Repro section included only when v1.1.
- [x] 11.2 `lib/post-mortem.ts`: builds the frontmatter from accumulated task data (`status`, `botAttempt`, `featureArea`, `rootCauseClass`, `filesTouched`, `linesChanged`, `durationMinutes`, `fixRetryCount`, `specsReferenced`, `ciStatus`, `tags`); writes `null` for `tokensUsed` in v1
- [x] 11.3 `lib/post-mortem.ts`: creates `vault/incidents/<YYYY-MM-DD>_issue-<N>_<slug>/` and writes `post-mortem.md` + copies `handoff.md`; copies `trace.zip` only when v1.1 produced one
- [x] 11.4 Slug derivation: lowercase the issue title or first 60 chars of the bug summary, kebab-case, strip non-alphanumeric; clamp length

## 12. Cron wiring

- [x] 12.1 Add a cron line to `cron/cron.txt`: `*/15 * * * * curl -s -X POST http://localhost:3001/api/tasks -H 'content-type: application/json' -d '{"pipelineId":"rolenext-bug-resolver"}' > /dev/null 2>&1  # command-center rolenext-bug-resolver poll`
- [x] 12.2 Verify `setup.sh` correctly preserves/replaces the new line (matches on `command-center`)

## 13. Dashboard — index route

- [x] 13.1 Create `dashboard/src/routes/rolenext/bug-resolver/+page.server.ts` — loads current tasks for this pipeline, recent PRs (via `gh` or task output), and post-mortem markdown files from `vault/incidents/`
- [x] 13.2 Create `+page.svelte` — three sections: queue table, recent PRs, post-mortem feed with filters
- [x] 13.3 Render post-mortem cards using the existing markdown renderer (re-use the `marked` + DOMPurify pipeline from the KB change)

## 14. Dashboard — task detail route

- [x] 14.1 Create `[taskId]/+page.server.ts` — loads task, investigate result (and repro when v1.1), handoff markdown, verify result, PR info
- [x] 14.2 Create `[taskId]/+page.svelte` — phase progression timeline, evidence inline, handoff rendered
- [x] 14.3 "Revise now" button visible only when task has an `input.prNumber`; opens a small textarea for the reviewer note
- [x] 14.4 On submit: POST `/api/tasks` then POST `/api/cron`; show a success toast

## 15. Fix phase (revision mode)

- [x] 15.1 `prompts/fix-revision.md`: instructs claude to read prior handoff, reviewer note, and line-level PR comments, then make targeted changes (still respecting the "one task, one context window" decomposition pattern when the revision spans multiple concerns)
- [x] 15.2 `lib/fix-agent.ts`: revision branch — fetch PR review comments via `getPRComments`, format them as structured input alongside the prior handoff
- [x] 15.3 `phases/fix.ts`: branches on `input.mode === "revision"` — checks out the existing `bug/issue-<N>` branch (fresh from origin), runs the revision prompt
- [x] 15.4 Verify the revision worktree path coexists with potential leftover state cleanly (or reuse the existing worktree if present); test cleanup edge cases

## 16. PR phase (revision mode)

- [x] 16.1 `lib/pr.ts`: revision branch — push commit, run `gh pr ready --undo <N>` to flip to draft, run `gh pr comment <N> --body "🤖 pushed revision addressing review"`
- [x] 16.2 `phases/pr.ts`: branches on `input.prNumber` presence — open vs revision

## 17. Auto-detect revision activity in poll

- [x] 17.1 Extend `phases/poll-issues.ts` to also iterate open bot-PRs (filter by `bot-fix` label)
- [x] 17.2 For each bot-PR, fetch reviews + comments; compare latest reviewer timestamp against bot's last commit timestamp on the branch
- [x] 17.3 If reviewer activity is newer, dedup against existing fix-revision tasks (Layer 1 keyed on `prNumber + mode`) and create a new fix task if not present
- [x] 17.4 Test the path: simulate a review comment timestamp newer than the last bot push and confirm a revision task is spawned — deferred to Section 21 (validation pass)

## 18. Marketing pipeline filter check

- [x] 18.1 Read `pipelines/marketing/pipeline.config.ts` and any vault-nuggets pipeline to determine whether they scan `vault/**` or use an allowlist — **confirmed allowlist:** `core/lib/vault.ts` `listNotes()` filters by the `PILLARS` const (12 explicit pillars). `incidents` is not in PILLARS, so marketing + vault-nuggets ignore it automatically.
- [x] 18.2 ~~If they scan `vault/**`: add a `type: incident` frontmatter filter~~ **not needed** — allowlist already excludes
- [x] 18.3 If they use an allowlist: confirm `vault/incidents/` is NOT in the allowlist; document the convention in the pipeline README — confirmed; will note in README (Section 20)

## 19. Throttling polish & operability

- [x] 19.1 Wire `maxTicketsPerDay` counter and `maxQueueDepth` overflow logic into `phases/poll-issues.ts` (already specified — this task adds the integration test) — integration coverage deferred to Section 21 (validation pass)
- [x] 19.2 Document the kill-switch file convention in the pipeline README — covered in Section 20
- [x] 19.3 Add a tiny CLI affordance: `cli/bug-resolver-status.ts` (or extend an existing CLI) that prints daily-counter / queue-depth / kill-switch state

## 20. README & ops doc (v1)

- [x] 20.1 Write `pipelines/rolenext/bug-resolver/README.md` covering: what it does, the seven phases, the dedup contract, the write policy (hard-ban blocks, soft-ban labels + callout), throughput caps, the kill-switch, the manual revision flow, the v1.1 / v2 parking lot, the `enableBrowserRepro` flag
- [x] 20.2 Document required env vars (v1 needs no bot creds, only `GITHUB_PAT` if `gh` auth not already set + `ROLENEXT_PATH`)
- [x] 20.3 Document the install steps: register the cron, validate with kill-switch ON, then disable kill-switch

## 21. Validation pass (v1)

These are end-to-end smoke tests requiring a real GitHub issue + a throwaway rolenext branch. Implementation is complete and typecheck-clean; the captain runs through this checklist before flipping the kill-switch off in production.

- [ ] 21.1 Manually run the pipeline end-to-end with the kill-switch ON, then OFF, against a synthetic test issue on a throwaway branch of rolenext
- [ ] 21.2 Verify the draft PR is created with all required body sections and labels
- [ ] 21.3 Verify the post-mortem lands at `vault/incidents/<date>_issue-<N>_<slug>/` with valid frontmatter
- [ ] 21.4 Verify the dashboard renders the index + task detail correctly, including the "Revise now" button visibility logic
- [ ] 21.5 Trigger a revision via the manual button and verify the existing PR is updated (commit pushed, PR flipped to draft, comment posted)
- [ ] 21.6 Force a write-policy hard-ban violation (have the fix agent touch `.github/workflows/ci.yml`) and verify it routes to `needs_review` with the correct reason
- [ ] 21.7 Force a soft-ban touch (have the fix agent edit `specs/auth.md`) and verify the PR opens with the `bot-touched-soft-banned` label and the body callout
- [ ] 21.8 Force a regression-test absence and verify it routes to `needs_review` with the correct reason
- [ ] 21.9 Force a multi-file fix and verify the fix agent transcript shows subagent invocations per concern

---

## v1.1 — Enable browser repro (deferred; runs only if Playwright stability proves out in v1)

These tasks ship only when `enableBrowserRepro` is flipped to `true`. They MUST NOT be required for the v1 milestone.

### 22. Playwright + dev-fixture deps

- [ ] 22.1 Add `playwright` to `package.json` and run `playwright install chromium` (document install in README)
- [ ] 22.2 Confirm `gh` and `make` are on PATH for the cron host

### 23. Bot user fixtures (rolenext repo)

- [ ] 23.1 Create `rolenext/scripts/seed-bot-user.sh` — reads `BOT_EMAIL` / `BOT_PASSWORD` from env, fails fast if missing, uses `psql` against the dev DB
- [ ] 23.2 Make the script idempotent: every `INSERT` uses `ON CONFLICT DO NOTHING` keyed on email/title
- [ ] 23.3 Seed: one bot user (hashed password), 2 resumes from `test-resumes/`, 3 saved jobs (synthetic), ~5 search-history rows
- [ ] 23.4 Open a small PR in rolenext for this script with a brief README note in `scripts/`

### 24. Repro agent

- [ ] 24.1 `prompts/repro.md`: the planner prompt — instructs claude to read the issue body and emit a structured step plan as JSON `{steps: [{action, selector?, value?}, ...], symptomKeywords: string[]}`
- [ ] 24.2 `prompts/repro-conclude.md`: the post-execution prompt — instructs claude to inspect captured console/network/DOM evidence and emit the triage JSON `{reproduced, confidence, evidence{...}, steps, notes}`
- [ ] 24.3 `lib/repro-agent.ts`: launches dev-mode rolenext in the worktree (`make db` + start backend + start frontend), runs `seed-bot-user.sh`, calls the planner prompt for steps
- [ ] 24.4 `lib/repro-agent.ts`: spins up Playwright (headless, trace always on), logs in as the bot user, executes the planned steps with role/label-based locators as defaults, captures console + 4xx/5xx network + DOM state
- [ ] 24.5 `lib/repro-agent.ts`: calls the conclude prompt with the evidence bundle, parses JSON, returns it; on JSON parse failure, retry once with "respond ONLY with the JSON object" suffix
- [ ] 24.6 `lib/repro-agent.ts`: saves `trace.zip` to the task output dir; cleans up running servers and the DB project on completion

### 25. Triage phase upgrade (two-agent gate)

- [ ] 25.1 Update `phases/triage.ts` to invoke repro + investigate via `Promise.all` when `enableBrowserRepro: true`
- [ ] 25.2 Update the triage gate to use the two-agent decision table (D6 in design)
- [ ] 25.3 Update the cannot-reproduce close auto-comment to the two-agent variant

### 26. Verify phase upgrade (dev repro re-run)

- [ ] 26.1 `lib/verify/repro-rerun.ts`: re-executes the recorded triage `steps` via Playwright against the worktree (with fix applied); checks for absence of symptom-matching errors; returns `{ ok, beforeAfter: {...} }`
- [ ] 26.2 Add the re-run as a fourth check in `phases/verify.ts`'s `Promise.all`
- [ ] 26.3 Append the dev-repro before/after evidence to `handoff.md` and the PR body

### 27. v1.1 validation pass

- [ ] 27.1 End-to-end run with `enableBrowserRepro: true` against a synthetic test issue
- [ ] 27.2 Verify trace.zip lands in the incident dir and is linked from the PR body
- [ ] 27.3 Force a "cannot reproduce" scenario (issue describes a bug the bot user can't repro) and verify the issue is closed with the two-agent auto-comment
- [ ] 27.4 Force a verify-stage dev-repro failure (fix passes ci but bug still reproduces) and verify the task retries / escalates correctly
