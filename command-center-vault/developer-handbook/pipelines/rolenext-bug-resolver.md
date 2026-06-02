# Pipeline: `rolenext-bug-resolver`

**Config:** `pipelines/rolenext/bug-resolver/pipeline.config.ts:69` (+ `ROLENEXT_BUG_RESOLVER_CONFIG` at line 36).

This is the most complex pipeline in the codebase: 7 phases, three shell-outs (`gh`, `git worktree`, `make ci`), three-layer dedup, a kill-switch, daily caps, fingerprint state, comment-triggered re-triage, PR-revision auto-spawn, and an own retry loop inside `verify`.

## Purpose (domain)

Autonomously resolve open GitHub Issues on the `ctrl-alt-adrian/rolenext` repo. Poll issues → triage each (v1: **code investigation only**, no browser repro) → write a handoff → attempt a fix in an isolated git worktree branched from `origin/main` → verify (write-policy scan + regression-test presence + `make ci`) → open a **draft** PR for the captain → write a structured post-mortem to `vault/incidents/`.

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut | shell-outs / state |
|---|---|---|---|---|
| `poll-issues` | auto_pass | `runPollIssues` — kill-switch check, prune fingerprints (14d), escalate stale tasks, read daily counter, `gh issue list` + `gh pr list --label bot-fix`, 3-layer dedup per issue, build a `TriageCandidate` for survivors, increment daily count, spawn revision tasks from reviewer activity. | `fanOut: fanOutPollIssues` → one triage task per candidate. | `gh`; reads/writes `state/fingerprints.json`, `state/daily-counter.json`, `state/.disabled`. |
| `triage` | **deterministic** (1 attempt) | `runTriage` — create worktree from `origin/main`, run investigate-agent (Sonnet, in worktree cwd), persist `investigate.json`, `computeDecision`, on cannot-repro auto-`closeIssue`, tear down worktree. | `check: checkTriage` reads the precomputed `decision`: `advance` → pass; `close-cannot-repro`/low-confidence/reopen → `needs_review`. | `git worktree`, `gh` (issue comments, close). |
| `write-handoff` | auto_pass | `runWriteHandoff` — `buildHandoff(...)`, write `handoff.md`, **embed the full body in output** (`handoffBody`) so downstream phases don't depend on this task's dir surviving. | none. | none. |
| `fix` | auto_pass | `runFixPhase` — open mode: recreate worktree, `runFix` (Claude in worktree cwd, 45-min cap), commits. Revision mode: recreate worktree at the PR branch tip, pull PR review comments, `runFixRevision`. | none. | `git worktree`, `git fetch/add`, `claude -p` (in cwd), `gh` (revision comments). |
| `verify` | **deterministic** (1 attempt) | `runVerifyPhase` — **owns its own retry loop**: `diffAgainstMain` → `scanWritePolicy` → `checkRegressionTests` → `runMakeCi`. CI-only failure + retries left → append CI log to handoff, re-`runFix` in place, re-check. | `check: checkVerify` passes iff `verify.ok`. | `git`, `make ci`, `claude -p` (retry fixes). |
| `pr` | auto_pass | `runPrPhase` — `pushBranch`, `createPR` **draft** assigned + reviewer `ctrl-alt-adrian`, labels `bot-fix,bug,auto-triaged` (+ `bot-touched-soft-banned` if any soft-ban hit). Revision mode pushes to existing branch, flips PR back to draft, comments. | none. | `git push`, `gh pr create`. |
| `post-mortem` | auto_pass | `runPostMortemPhase` — Claude → write `vault/incidents/<date>_issue-N_slug/post-mortem.md`, tear down worktree, update fingerprint to terminal status. | none. | `claude -p` (`core/lib/claude.ts`), worktree cleanup. |

## Data flow

- **Input source:** cron POST `/api/tasks` `{"pipelineId":"rolenext-bug-resolver"}` — active in `cron/cron.txt` at `*/15 * * * *` (every 15 min).
- **Phase-to-phase carry:** the processor merges each phase's `output` into the next task's `input`. Critically, `write-handoff` embeds the full markdown in `output.handoffBody` and `verify` re-emits the (possibly CI-failure-annotated) `handoffBody` so `pr` and `post-mortem` never need the prior task's filesystem dir. `loadHandoffForTask(task)` prefers `input.handoffBody`, falling back to a legacy file read.
- **Worktrees:** `~/Developer/projects/.worktrees/rolenext-issue-<N>` on branch `bug/issue-<N>`, always built from `origin/main` after a `git fetch origin main` (`lib/worktree.ts:48-70`). State files (`fingerprints.json`, `daily-counter.json`, `.disabled`) live in `state/` and are git-ignored.

### poll-issues — dedup + fan-out

Three dedup layers (`lib/dedup.ts`), short-circuiting on the first skip:

1. **Layer 1** — a live (non-terminal-bad) task already exists for this issue number.
2. **Layer 2** — GitHub state: issue closed, carries a skip label (`wontfix`/`duplicate`/`no-bot`), or an open bot-PR body says `Closes #N`.
3. **Layer 3** — fingerprint match (`sha256(normalizedPageUrl + first-200-chars-of-description)`) against a recent (`< 14d`) `in-flight`/`pr-open`/`merged` record.

Special cases: **reopened** issues bypass Layer 1 (`checkDedupForReopen`); a Layer-1 skip **plus new non-bot comment activity** since the last task triggers a comment-triggered re-triage routed through the reopen path; reopen `attempt > 3` forces `needs_review`. Daily cap (`maxTicketsPerDay: 5`) defers + labels `bot-deferred`; queue cap (`maxQueueDepth: 20`) sets an overflow sentinel.

```ts
// pipelines/rolenext/bug-resolver/phases/poll-issues.ts:405-409
export async function fanOutPollIssues(task: Task): Promise<Array<Record<string, unknown>>> {
  const out = task.output as PollOutput | undefined;
  if (!out || !Array.isArray(out.candidates)) return [];
  return out.candidates.map((c) => ({ ...c }));
}
```

### triage — investigate + gate decision

```ts
// pipelines/rolenext/bug-resolver/phases/triage.ts:161-186 (computeDecision)
export function computeDecision(outcome, isReopen, triageThreshold): TriageDecision {
  if (isReopen) return { kind: "needs_review", reason: `reopen attempt — investigate ${outcome.ok ? "succeeded" : "failed"}` };
  if (!outcome.ok) return { kind: "needs_review", reason: "agent failed to produce structured output" };
  const r = outcome.result;
  if (r.noBugFound === true) return { kind: "close-cannot-repro", comment: CANNOT_REPRO_AUTOCOMMENT_INVESTIGATE_ONLY };
  if (r.fixKnown && r.confidence > triageThreshold) return { kind: "advance" };   // threshold 0.7
  return { kind: "needs_review", reason: "low confidence or unclear root cause" };
}
```

The investigate agent (`lib/investigate-agent.ts`) runs `claudeInCwd` with `model: claude-sonnet-4-6`, 12-min cap, reading `prompts/investigate.md` + live issue comments; it must return a strict JSON object (`fixKnown`, `confidence` 0–1, `rootCause`, `filesImplicated[]`, `proposedFix`, `noBugFound?`). One JSON-parse retry with a strict suffix.

### verify — the own retry loop

`verify` does NOT use the processor's retry-in-place (that re-runs the same phase against the same diff, useless here). It re-invokes the fix agent **only when `make ci` is the sole remaining failure**:

```ts
// pipelines/rolenext/bug-resolver/phases/verify.ts:225-288 (abridged)
const maxAttempts = 1 + Math.max(0, cfg.fixRetries); // fixRetries=2 → up to 3 attempts
let checks = await runAllChecks({ worktreePath, cfg, ctx, attemptNumber: 1 });
while (!checks.attempt.failures.length || checks.ciOnlyFailure) {
  if (checks.attempt.failures.length === 0) break;       // all good
  if (attemptNumber >= maxAttempts) break;               // out of retries
  if (!checks.ciOnlyFailure) break;                       // failure isn't CI-fixable
  currentHandoff = appendAttemptFailure(currentHandoff, attemptNumber, `STDOUT…STDERR…`, "make ci was not green …");
  const fix = await runFix({ worktreePath, handoffBody: currentHandoff, issueNumber: input.issueNumber }); // commits on top
  if (fix.blocked || !fix.committed) { /* record + break */ }
  attemptNumber++;
  checks = await runAllChecks({ worktreePath, cfg, ctx, attemptNumber }); // re-diff, re-policy, re-ci
}
```

`runAllChecks` ordering matters: `make ci` is **skipped** if write-policy or regression-test already failed (CI re-runs won't fix those). `ciOnlyFailure = writePolicy.ok && regression.ok && makeCi !== null && !makeCi.ok`.

## Write policy

`scanWritePolicy(paths, hardBan, softBan)` (`lib/verify/write-policy.ts`):
- **hardBan** (BLOCKS the verify gate): `*.env`, `*.env.*`, `backend/db/migrations/**`, `.github/**`.
- **softBan** (recorded only → PR label + body callout, does NOT block): `specs/**`, `docker-compose.yml`, `Makefile`, `package.json`, `pnpm-lock.yaml`, `go.mod/go.sum/go.work*`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`.

Globs are converted to regex by a minimal `globToRegex` (`*` = within-segment, `**` = any segments). The fix-agent prompt also states the hard bans and tells the agent to emit a `BLOCKED:` line rather than touch them (`prompts/fix.md`).

`checkRegressionTests(paths)` (`lib/verify/regression-test.ts`) passes when ≥1 diff path matches a test pattern (`backend/**test*`, `frontend/**test*`, `services/**test*`, `testing/**`); enforced because `requireRegressionTest: true`.

## Config knobs (`ROLENEXT_BUG_RESOLVER_CONFIG`)

| key | value |
|---|---|
| `repo` | `ctrl-alt-adrian/rolenext` |
| `rolenextPath` | `/home/adrian/Developer/projects/rolenext` |
| `worktreeBase` | `/home/adrian/Developer/projects/.worktrees` |
| `enableBrowserRepro` | `false` (v1 investigate-only) |
| `reproTarget` | `"none"` |
| `caps.maxTicketsPerDay` | `5` |
| `caps.maxQueueDepth` | `20` |
| `caps.ticketStaleAfterDays` | `7` |
| `caps.concurrency` | `1` |
| `triageThreshold` | `0.7` |
| `requireRegressionTest` | `true` |
| `fixRetries` | `2` |
| `killSwitchFile` | `.disabled` |

Pipeline-level: `backpressureCap: 5`, `perTickCap: 5`, `cronSchedule: "*/15 * * * *"`. Phase timeouts: poll 5m, triage 15m, write-handoff 1m, fix 50m, verify **210m** (worst case `1 + fixRetries` fixes + CI runs), pr 5m, post-mortem 5m.

## Slop rules

**None.** Quality control here is the verify gate (write-policy + regression + CI), not a slop pack.

## Key helper functions (`lib/`)

- `github.ts` — `gh`-CLI wrappers: `listOpenIssues`, `listOpenPRs`, `getIssue`, `getIssueComments`, `getPRComments`, `getPRReviews`, `prDiff`, `labelIssue`, `closeIssue`, `commentOnPR`, `prDraft`, `createPR(repo, opts)`, `isReopened`, `hasLabel`.
- `worktree.ts` — `createWorktree`, `removeWorktree`, `diffAgainstMain`, `fullDiffAgainstMain`, `worktreePathFor`, `branchNameFor`.
- `dedup.ts` — `checkDedup`, `checkDedupForReopen`, `computeFingerprint`, `extractPageUrl`.
- `state.ts` — `loadFingerprints`, `upsertFingerprint`, `pruneFingerprints`, `readDailyCount`, `incrementDailyCount`, `killSwitchActive` (all file-locked via `withFileLock`).
- `investigate-agent.ts` — `runInvestigate(input): Promise<InvestigateOutcome>`.
- `fix-agent.ts` — `runFix(input)`, `runFixRevision(input)` (45-min cap, detects trailing `BLOCKED:` line, checks `git rev-list origin/main..HEAD` for a commit).
- `verify/{write-policy,regression-test,make-ci}.ts` — `scanWritePolicy`, `checkRegressionTests`, `runMakeCi(cwd)` (`spawn make ci`, 20-min cap, 64 KB stdout/stderr tails).
- `handoff.ts` — `buildHandoff`, `writeHandoff`, `loadHandoffForTask`, `appendAttemptFailure`.
- `pr.ts` — `buildPrTitle`, `buildPrBody`, `deriveArea`, `pushBranch`.
- `post-mortem.ts` — `buildAndWritePostMortem(...)` → `vault/incidents/<date>_issue-N_<slug>/`; `ROOT_CAUSE_TAXONOMY` (15 classes).

### PR creation

```ts
// pipelines/rolenext/bug-resolver/phases/pr.ts:157-166
prUrl = await createPR(cfg.repo, {
  title, body, head: branch, base: "main", draft: true,
  labels,                       // ["bot-fix","bug","auto-triaged"] (+ soft-ban label)
  assignees: [CAPTAIN_USER],    // "ctrl-alt-adrian"
  reviewers: [CAPTAIN_USER],
});
```

`createPR` shells `gh pr create --repo … --draft --label … --assignee … --reviewer …` (`lib/github.ts:217`).

## Working-vs-stub verdict

**Working in v1 — investigate-only.** The full chain runs: real `gh` polling, real worktrees, real Sonnet investigate + fix agents, real `make ci`, real draft PRs, real post-mortems. The deliberate v1 limitation is **no browser reproduction**: `enableBrowserRepro: false` and `reproTarget: "none"`, and `triage.ts` comments confirm the path is "fixed to investigate-only" regardless (`triage.ts:100-101`). Honest caveats:

- The PR is always **draft** and assigned to the captain — the bot never merges. Human confirms.
- `cannot-repro` → the bot **closes the issue** as a side effect, then lands the task in `needs_review` so the captain confirms the close (the core processor can't produce a terminal `completed` from a non-final phase, `triage.ts:126-138`).
- The PR-revision-detection heuristic uses `pr.updatedAt` as a proxy for the bot's last push and is explicitly flagged as approximate (`poll-issues.ts:108-117`).
- `post-mortem` records `tokensUsed: null` and `linesChanged: 0` in v1 (not computed).

## Cross-links

- Gates + rewind (deterministic `triage`/`verify`): [../core/04-gates.md](../core/04-gates.md)
- Processor input-merge + retry: [../core/03-processor.md](../core/03-processor.md)
- Claude wrapper (post-mortem uses core `claude`; agents use per-pipeline `claudeInCwd`): [../core/06-claude-wrapper.md](../core/06-claude-wrapper.md)
- Sibling rolenext pipeline: [rolenext-job-apply.md](rolenext-job-apply.md)
