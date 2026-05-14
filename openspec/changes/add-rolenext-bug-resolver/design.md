## Context

Command-center already runs a linear pipeline processor (`core/lib/processor.ts`) with three gate types (`auto_pass | deterministic | needs_review`), backpressure on `needs_review` queues, and cron-driven entry. Five pipelines are registered today (marketing, competitors, reddit-pmf, vault-nuggets, software-factory-housekeeping). The `software-factory` namespace was scaffolded in phase 6 as the home for "the system maintaining itself" — currently just the daily housekeeping job, with `spec-to-pr`/`test-triage`/`dep-bump` reserved as future inhabitants of that same self-maintenance theme. This change introduces a **new top-level namespace `rolenext/`** for command-center automation that operates on the rolenext repo specifically. Keeping it separate from `software-factory` preserves the "system maintaining itself" framing for that domain and gives rolenext-specific automation (this bug resolver, future deploy monitors, changelog generators, etc.) a clean home.

RoleNext, the target repo, is a separate codebase at `/home/adrian/Developer/projects/rolenext` — Go backend + React/Vite frontend + Postgres in Docker, with `make ci`, `make test-backend`, `make test-frontend`, and a `specs/` directory indexed by `specs/spec-map.md` (15 feature specs). The in-app support widget already POSTs bug reports to GitHub Issues via a `GITHUB_PAT` and attaches screenshots + page URL + user-agent (see `rolenext/specs/support-channel.md`).

The pipeline being designed here is the first **autonomous-dev** pipeline. It does work on a *different repository's* source code, on the captain's local machine, on an isolated git worktree, and surfaces results through draft PRs the captain reviews and merges. The captain remains the merge gatekeeper for v1.

## Goals / Non-Goals

**Goals:**

- Eliminate the captain's manual loop of "open issue → repro → investigate → fix → PR" for bugs that are reproducible and have a clear fix path.
- Capture **structured signal** (post-mortem frontmatter taxonomy) so over time we can answer "what classes of bugs is the bot good at? what areas of rolenext break most?"
- Preserve the captain's veto: every fix lands as a draft PR with a human reviewer; bot never auto-merges.
- Stay fully **local** — no cloud runners, no managed services beyond GitHub itself.
- Reuse the existing pipeline/phase/gate substrate without modifying `core/lib/`.

**Non-Goals:**

- **Browser-based repro in v1.** Playwright + dev DB + seeded bot user + per-worktree server startup is a high-cost dependency chain. v1 ships **investigate-only** triage behind `enableBrowserRepro: false`. The browser-repro path is fully designed (see D5, D14) but gated behind the flag and implemented as a v1.1 enablement only if Playwright stability proves out — per the session-9 "prune the nice-to-have" guidance.
- **Production-targeted repro.** Even when browser repro lands (v1.1), it targets the dev worktree. Hitting prod is v2 and requires a prod bot account + separate creds.
- Multi-repo support. v1 is rolenext-only; config takes paths and a target repo, so a future generalization is config-only, but designing for it now is premature.
- Bot review-comment auto-iteration via webhook. v1 picks up review comments either on the next 15-min poll or via a manual "Revise now" button. Webhook-driven instant iteration is parked for v2.
- Semantic-similarity dedup (Layer 4). v1 ships deterministic dedup only.
- True "fail-before-pass-after" regression-test verification. v1 only checks for the **presence** of a new/modified test file in the diff.
- Token-cost analytics. The `claude -p` wrapper doesn't expose usage; capturing this requires a wrapper change that's not in scope. `tokensUsed` is recorded as `null` in v1 frontmatter.
- Severity-priority ordering. The support widget doesn't capture severity today; FIFO for v1.
- Concurrent fix execution. `concurrency: 1` — one worktree at a time. Higher concurrency requires isolating per-worktree Postgres instances, parked.

## Decisions

### D1 — Pipeline shape: linear with parallelism inside `triage` and `verify`

The diagram had parallel branches (repro + investigate run concurrently, then converge at handoff). The core processor is strictly linear — one phase produces input for the next.

```
poll-issues → triage → write-handoff → fix → verify → pr → post-mortem
```

**Decision:** Keep the processor linear. Express parallelism *inside* phases via `Promise.all` **when the underlying work supports it**. In v1 (browser repro off), `triage.run()` invokes the investigate agent only — no Promise.all is needed because there's a single agent. When `enableBrowserRepro` is true (v1.1), `triage.run()` adds the repro agent as a second branch via `Promise.all`. The `verify` phase runs three checks concurrently in v1 (write-policy scan, regression-test presence, `make ci`); the dev-repro re-run is a fourth check added in v1.1 alongside browser repro.

**Alternatives considered:**

- *Split into two child tasks + join phase.* Would require new core support for "wait on N siblings". Rejected — core changes are out of scope and the Promise.all idiom is sufficient.
- *Single mega-prompt that does both repro + investigate in one agent.* Rejected — agents specialize cleanly; separate prompts are easier to maintain and the structured-JSON outputs are independent signals.

### D2 — Deterministic 3-layer dedup

```
LAYER 1: task-store lookup
  listTasks().some(t => t.input.issueNumber === N
                     && t.status !== "failed"
                     && t.status !== "cleared_stale")
  → skip

LAYER 2: GitHub state
  - issue closed                                    → skip
  - issue has linked PR (open or recently merged)   → skip
  - issue has label wontfix|duplicate|no-bot        → skip

LAYER 3: fingerprint
  fp = sha256(normalize(pageUrl) + "::" +
              normalize(first200chars(description)))
  normalize(pageUrl):     drop query, drop trailing slash, lowercase
  normalize(description): lowercase, strip non-alphanumeric,
                          collapse whitespace
  store: pipelines/.../state/fingerprints.json
         { [fp]: { issueNumber, status, prUrl, seenAt } }
  - fp match within last 14 days
    AND matched issue's PR is open or merged
    → label new issue "bot-skipped" + "duplicate-of-<N>"
    → skip (no GitHub comment)
```

**Reopens** (`state_reason: "reopened"` on the issue) bypass Layer 1. A new task is spawned with `input.attempt: <prevAttempt + 1>`. The investigate agent's context includes the prior merged PR's diff (`gh pr diff <priorPR>`) so it can reason about "what we shipped vs. what's still broken." Triage gate is forced to `needs_review` regardless of confidence — the captain decides whether to proceed.

**Skip visibility:** dashboard row + GitHub labels only. No GitHub comments (avoid notification noise).

**Alternatives considered:**

- *Semantic similarity (Layer 4).* Embedding or LLM-based dedup catches "different words, same bug". Rejected for v1 because non-deterministic and not yet needed at zero traffic. Re-evaluate post-alpha.
- *Bot comments "🤖 triage started" on each issue.* Visible status, but creates a state-in-two-places drift hazard with the task DB. Rejected — task DB is the single source of truth.

### D3 — Worktree always branched from `origin/main`, never local

```
git fetch origin main
git worktree add ../.worktrees/rolenext-issue-N origin/main -b bug/issue-N
```

**Decision:** Every task spawn fetches `origin/main` and branches the worktree off it. The captain's local main can be on any branch, with any uncommitted state, dirty or clean — the bot never reads it. Verify-phase diff baseline (`git diff --name-only origin/main...HEAD`) uses the same `origin/main` ref.

**Rationale:** Eliminates a class of "the bot included my unrelated WIP in the fix" failure modes. Costs one `git fetch` per task; negligible.

### D4 — Repro environment

**v1 (default):** investigate-only. No dev-server startup, no bot user, no browser. The investigate agent reads `specs/spec-map.md` and the worktree source code. `reproTarget` defaults to `"none"`.

**v1.1 (when `enableBrowserRepro: true`):** dev worktree. `make db` + `make backend &` + `make frontend &` in the worktree, seed the bot user via `rolenext/scripts/seed-bot-user.sh` (idempotent, reads creds from env), Playwright against `http://localhost:<port>`. Single rich bot user with 2 resumes, 3 saved jobs, search history.

```ts
// v1 defaults
{
  enableBrowserRepro: false,
  reproTarget: "none",
}
// v1.1 flip
{
  enableBrowserRepro: true,
  reproTarget: "worktree-dev",
}
// v2 prod target (parked)
{
  enableBrowserRepro: true,
  reproTarget: "prod",
  prodBaseUrl: "https://rolenext.app",
  prodBotCredsEnv: { email: "PROD_BOT_EMAIL", password: "PROD_BOT_PASSWORD" },
}
```

**v2 (parked)** replaces the Playwright base URL with prod and uses a separate prod bot account. Fix loop still happens in the dev worktree — only the *triage* repro target flips. v2 prod bot is a **separate** account (`bot@rolenext.app`), not the same identity as the dev bot, so blast radius and revocation are distinct.

**Why v1 ships investigate-only:** the browser-repro pipeline (Playwright + dev DB + seed user + per-worktree compose project + headed/headless fallback + selector brittleness) is a multi-failure-mode dependency chain. v1 validates the end-to-end loop (poll → investigate → handoff → fix → verify → PR → post-mortem) before adding the repro path. Once v1 is stable, v1.1 layers in browser repro behind the flag.

**Alternatives considered:**

- *Auth-bypass header in dev only.* Faster repro (skip login UI), but requires backend changes in rolenext (violates "gate from command-center, don't touch rolenext"). Rejected.
- *Ship browser repro in v1.* Rejected — see "Why v1 ships investigate-only" above and session-9 "prune the nice-to-have" guidance.

### D5 — Browser automation (v1.1): Playwright, headless, trace always on

**This decision applies only when `enableBrowserRepro: true`.**

Headless by default (3–5x faster than headed, no display needed). Trace recording always on, stored at `vault/incidents/<date>_issue-N_<slug>/trace.zip` (~5–50MB per trace). Storage pruning happens in housekeeping later (incidents > 30 days old → delete trace.zip, keep markdown).

**Alternatives considered:** Puppeteer (Chromium-only, no trace viewer), Selenium (heavier setup), Cypress (headless quirks). All rejected — Playwright's multi-browser + trace viewer + auto-wait win cleanly.

The repro flow per ticket (v1.1):

1. spawn worktree from `origin/main`
2. `make db` (Postgres up — unique `COMPOSE_PROJECT_NAME` per worktree to avoid collision when v2 raises concurrency)
3. `scripts/seed-bot-user.sh` (seeds rich bot user)
4. `make backend &` + `make frontend &`
5. claude `-p` reads the issue body and generates a structured step plan (clicks, fills, navigations) keyed by accessible locators (`getByRole`, `getByLabel`)
6. Playwright executes the plan; captures console, network 4xx/5xx, DOM state
7. emits structured JSON: `{ reproduced, confidence, evidence{...}, steps[], notes }`
8. tear down: kill servers, `git worktree remove`

### D6 — Triage gate: deterministic, structured-JSON inputs, threshold 0.7

Investigate agent always returns JSON:

```ts
// investigate
{ fixKnown: bool, confidence: number, rootCause: string,
  filesImplicated: { path: string, lineRange?: [number, number] }[],
  specsReferenced: string[], proposedFix: string, notes: string,
  noBugFound?: bool   // optional — agent affirmatively concludes no bug
}
```

Repro agent (v1.1, when `enableBrowserRepro: true`) additionally returns:

```ts
// repro
{ reproduced: bool, confidence: number,
  evidence: { consoleErrors: string[], httpFailures: {...}[],
              domStateMatched: bool, matchedSymptomFromIssue: bool },
  steps: { action: string, selector?: string, value?: string }[],
  notes: string }
```

**Gate logic — v1 (investigate-only):**

```
investigate JSON parse failure                → needs_review
  reason: "agent failed to produce structured output"

investigate.fixKnown && investigate.confidence > triageThreshold
                                              → advance to handoff

investigate.noBugFound === true               → side-effect close issue with
                                                auto-comment "🤖 investigation
                                                did not surface a code-level
                                                bug — closing. Reopen with more
                                                detail if it persists."
                                                + needs_review with reason
                                                "close: cannot-reproduce
                                                (no code-level bug)"
                                                (captain confirms close on
                                                dashboard)

(everything else: !fixKnown, low confidence)  → needs_review
```

**Gate logic — v1.1 (browser repro enabled):**

```
either JSON parse failure                     → needs_review

repro.reproduced && investigate.fixKnown
  && repro.confidence > triageThreshold
  && investigate.confidence > triageThreshold → advance to handoff

!repro.reproduced && !investigate.fixKnown    → side-effect close issue with
                                                auto-comment "🤖 cannot
                                                reproduce — closing. Reopen
                                                if the bug persists."
                                                + needs_review with reason
                                                "close: cannot-reproduce"
                                                (captain confirms close on
                                                dashboard)

(mixed signals or low confidence)             → needs_review
```

**Why `needs_review` on close paths and not `completed`:** the core processor (`core/lib/processor.ts`) cannot produce a `completed` terminal state from a non-final phase via the deterministic gate machinery — the only path to `completed` mid-pipeline is `advanceOrComplete` advancing to the next phase, or a `fanOut` returning 0 elements from an `auto_pass` phase. Neither fits the "close + don't advance" semantics. We keep the gate `deterministic`, close the issue as a side effect inside `runTriage`, then let the gate land the task in `needs_review` with a distinctive `gateFailReason`. The captain confirms the recommended close from the dashboard. **Strictly safer than auto-completing.** A future enhancement may add a `terminate(reason)` helper to the processor; for v1, this adaptation preserves all behaviors with zero core changes.

**Threshold (0.7) is a config dial** — start conservative, retune based on false-advance vs false-needs_review rates.

**Alternatives considered:**

- *Free-form claude reads both agent outputs and decides.* Adds a third expensive call, non-deterministic. Rejected for v1.
- *Meta-agent only as tie-breaker for the ambiguous middle.* Hybrid Option C from the exploration. The infrastructure for this lives behind a flag; v1 ships with it disabled. Re-enable post-alpha if needs_review queue gets noisy.

### D7 — Fix phase: two modes + subagent decomposition

```
mode=open (first attempt for a new bug)
  input: handoff.md, spec-map.md, worktree path
  claude -p edits files in the worktree
  on completion: captures `git diff origin/main...HEAD`

mode=revision (captain requested changes)
  input: priorHandoff.md, reviewerNote (optional, from manual button),
         auto-pulled `gh api /repos/.../pulls/N/comments` (line-level),
         priorHandoff.md
  same worktree branch is checked out fresh from origin/main + cherry-picked
  prior commit, OR re-cloned at the existing branch tip (TBD during impl)
```

**Subagent decomposition (one task, one context window).** The fix agent's first step is to decompose the work in `handoff.md` into independent units — typically one per file, per package, or per concern. For each unit, the fix agent spawns a subagent receiving only the slice of `handoff.md` it needs plus the specific files in scope. Each subagent's context window stays focused on a single concern. The parent fix agent then assembles the regression test (which spans the fix) and verifies the overall diff is coherent.

This matches the session-9 guidance: *"If you give a model two tasks in the same context window, performance degrades."* Multi-file fixes are exactly the case where attention split would hurt quality.

When the fix is single-file or single-function, the fix agent may skip decomposition and edit directly. The prompt makes that judgment.

**Retry policy:** the fix-retry loop is owned by **`verify.run()`**, not by the processor's per-phase retry primitive. Rationale: the processor's retry is "re-dispatch the same phase against unchanged state" — that's useless here because `make ci` would produce the same failure against the same diff. So `verify.run()` itself, when `make ci` is the SOLE failure (write-policy + regression already passed), appends the failure log to `handoff.md` via `appendAttemptFailure`, re-invokes the fix agent against the same worktree (the fix agent commits on top of prior commits), then re-runs all checks. Loops up to `cfg.fixRetries` additional attempts (total = 1 initial + `fixRetries`). After the loop terminates, the verify gate passes if the final attempt is clean, else fails to `needs_review`. Each attempt is recorded in `verify.json.attempts[]` for the PR body / dashboard.

### D8 — Verify gate: three checks in v1, four in v1.1

**Soft-ban paths do NOT block the pipeline.** Per session-9 "only human checkpoint is staging before deploy" — and per captain's "I review every PR" decision — the PR review **is** the human gate for soft-ban-category edits. Routing them to mid-pipeline `needs_review` AND then surfacing them in the PR review is double-gating the same human decision. v1 collapses that: soft-ban touches result in a PR label + body callout, not a gate.

```
1. WRITE POLICY DIFF SCAN
   git diff --name-only origin/main...HEAD
   for each path:
     match hardBan glob → fail to needs_review
       reason: "fix touched <path> (hard-banned)"
     match softBan glob → record path; do NOT fail
     else → continue

   On success, pass the recorded soft-ban paths forward as
   `verify.softBanTouched: string[]`. The PR phase reads this:
   - if non-empty:
       PR label `bot-touched-soft-banned` added
       PR body includes a `⚠️ Soft-ban paths touched` callout
         listing each path with the reason category
         (specs / build / deps / compose / Makefile)
   - if empty: no extra label, no callout

   hardBan: ["*.env", "*.env.*",
             "backend/db/migrations/**", ".github/**"]
   softBan: ["specs/**", "docker-compose.yml", "Makefile",
             "package.json", "pnpm-lock.yaml",
             "go.mod", "go.sum", "go.work*",
             "frontend/vite.config.ts", "frontend/vitest.config.ts"]

2. REGRESSION TEST PRESENCE
   diff must include ≥1 new or modified file matching:
     backend/**/test*  OR  frontend/**/*test*  OR  testing/**
   else → needs_review, reason: "no regression test added"

3. MAKE CI
   cd worktree && make ci
   exit 0 → pass; non-zero → fail (retry or needs_review per D7)

[v1.1, when enableBrowserRepro: true]
4. DEV REPRO RE-RUN
   Playwright re-runs the original `steps` from triage repro JSON
   against the dev worktree (with fix applied).
   bug must NOT occur (no matching console errors / HTTP failures /
   DOM state).
   captures before/after evidence for the PR body.
```

Checks run concurrently where possible (`Promise.all`). Any blocking failure short-circuits the rest.

**Why drop soft-ban → needs_review:**

- Captain reviews every PR (already chosen). The PR review surfaces the diff including soft-ban paths.
- Mid-pipeline `needs_review` for soft-ban requires the captain to (a) inspect the diff in the dashboard, (b) approve/reject there, (c) re-inspect the same diff in the PR review. Same decision, two interfaces.
- Soft-ban paths are not destructive — they're "deserves extra scrutiny." Surfacing them via labels + body callout preserves the scrutiny signal without the dashboard round-trip.
- Hard-ban paths (secrets, migrations, CI workflows) remain blocked at the gate because they ARE destructive — they should never reach a PR.

**Alternatives considered:**

- *Keep soft-ban → needs_review.* Rejected per the above; double-gating without correctness gain.
- *Drop the soft-ban category entirely.* Loses the scrutiny signal; rejected. Label + callout is the right preservation.
- *Fail-before-pass-after regression test semantics* — check out the pre-fix state, run the new test, confirm it fails; then apply fix, confirm it passes. Strictly stronger correctness but more orchestration. Parked for v2.

### D9 — PR phase, draft + revision-aware

```
mode=open
  push origin bug/issue-N
  gh pr create --draft \
    --title "fix(<area>): <bug summary> [#N]" \
    --body "$(cat pr-body.md)" \
    --label bot-fix --label bug --label auto-triaged \
    [--label bot-touched-soft-banned  if verify.softBanTouched non-empty] \
    --assignee ctrl-alt-adrian --reviewer ctrl-alt-adrian
  PR body includes: bug summary, Closes #N,
                    [⚠️ Soft-ban paths touched callout when applicable],
                    repro evidence (v1.1 only),
                    root cause, fix summary, verification checklist,
                    full handoff.md in <details>, attribution footer.

mode=revision
  push origin bug/issue-N (existing branch)
  gh pr ready --undo <prNumber>          # flip back to draft
  gh pr comment <prNumber> --body "🤖 pushed revision addressing review"
  (do NOT open a new PR)
```

**Captain workflow:**

1. Notification: PR opened (draft).
2. Captain reviews diff + PR body, optionally pulls branch to test locally.
3. If happy: `Mark ready for review` → GitHub Actions CI fires.
4. CI green → captain merges manually.
5. If unhappy: leave PR review comments. Within 15 min the auto-poll detects new reviewer activity and spawns a revision task; OR captain clicks "Revise now" on the dashboard for immediate dispatch.

### D10 — Throughput caps

```ts
{
  maxTicketsPerDay: 5,         // UTC day rollover
  maxQueueDepth: 20,           // pipeline auto-pauses past this
  ticketStaleAfterDays: 7,     // queued > 7d → auto needs_review
  concurrency: 1,              // one worktree active at a time
  killSwitchFile: ".disabled", // poll phase no-ops if present
}
```

Implementation: poll-issues phase reads counters from `state.ts` (daily counter, queue depth) and the kill-switch file before creating any task. Existing `paused_backpressure` semantics in the processor are unchanged — that's for the per-pipeline `needs_review` cap (`backpressureCap`), a different concern.

**Alternative considered:** *Rolling 24h window vs UTC day.* UTC day creates a discontinuity at midnight; rolling is smoother but adds complexity. v1 = UTC day; flip if it bites.

### D11 — Post-mortem schema and storage

```
vault/incidents/<YYYY-MM-DD>_issue-<N>_<slug>/
├── post-mortem.md
├── handoff.md     (archived, full trace)
└── trace.zip      (Playwright trace)
```

Frontmatter:

```yaml
---
type: incident
issueNumber: 47
prNumber: 152
date: 2026-05-14
status: resolved | escalated | cannot-reproduce
botAttempt: 1
featureArea: job-tracker
rootCauseClass: missing-null-check
filesTouched: 2
linesChanged: 14
tokensUsed: null               # v1; populated in v2
durationMinutes: 18
fixRetryCount: 0
specsReferenced: [job-tracker-api]
ciStatus: passed
reproEvidence: incidents/2026-05-14_issue-47/trace.zip
tags: [auth-flow, tracker, null-handling]
---
```

`rootCauseClass` taxonomy (fixed list; `other` is the escape valve):

```
missing-null-check | off-by-one | race-condition | type-mismatch
missing-validation | wrong-state-transition | regex-error
timezone | encoding | missing-migration | api-contract-drift
dependency-bug | spec-implementation-gap | other
```

**Location rationale:** `vault/incidents/` is a NEW top-level vault directory. Operational signal (bug fixes, deployments, downtime) is semantically different from marketing-mined KB content (insights, frameworks, mental models). Keeping them in separate dirs avoids the marketing pipeline accidentally surfacing bot-fix recaps as marketing draft candidates.

**If the marketing/vault-nuggets pipeline currently scans `vault/**` rather than an explicit allowlist**, we add a `type: incident` frontmatter filter to it. (To be verified during implementation — if it already uses an allowlist, no change needed.)

### D12 — Dashboard surface

Two new routes under `dashboard/src/routes/rolenext/bug-resolver/`:

```
/rolenext/bug-resolver
  ├── current queue (pending / running / paused / needs_review)
  ├── recent PRs (open / ready-for-review / merged) with status
  └── post-mortem feed
       - filterable: featureArea, rootCauseClass, status
       - click → renders post-mortem.md via the existing
                 markdown renderer (marked + DOMPurify, added in the
                 previous KB change)

/rolenext/bug-resolver/[taskId]
  - task detail: phase progression, repro evidence inline
  - handoff.md rendered
  - "Revise now" button (visible when task has an open PR)
       → POST /api/tasks { pipelineId, phaseId: "fix",
                           input: { issueNumber, prNumber,
                                    mode: "revision", reviewerNote } }
       → POST /api/cron (drains queue immediately, no 5-min wait)
```

### D14 — Browser repro is opt-in via `enableBrowserRepro` (default false)

The pipeline config carries a single boolean `enableBrowserRepro` that gates the entire browser-repro path:

```ts
{ enableBrowserRepro: false }   // v1 default
{ enableBrowserRepro: true }    // v1.1 enablement
```

**When false (v1):**

- Triage phase runs investigate agent only (no Playwright, no `make db`, no bot user, no dev-server startup).
- Triage gate uses the simplified investigate-only decision table (D6).
- Verify phase runs three checks (write-policy, regression-test, `make ci`); the dev-repro re-run is skipped.
- `handoff.md` and PR body omit the "Repro evidence" section.
- The rolenext seed script and `BOT_EMAIL`/`BOT_PASSWORD` env vars are not required.

**When true (v1.1):**

- Triage phase additionally runs the Playwright repro agent.
- Triage gate uses the two-agent decision table.
- Verify phase adds the dev repro re-run as a fourth check.
- All Playwright/dev-server/bot-user dependencies are required.

**Why a feature flag and not a separate change:**

The two paths share the same pipeline shape, the same dedup, the same write policy, the same PR / post-mortem / dashboard surfaces. Splitting into two changes would duplicate the spec. A single flag lets v1 ship fast, validates the loop end-to-end, and lets v1.1 layer in browser repro as a smaller follow-up scoped to the agent + verify-check additions only.

### D13 — No changes to `core/lib/`

The pipeline uses existing primitives: `PipelineConfig`, `PhaseConfig` with `auto_pass`/`deterministic` gates, `Promise.all` inside `phase.run()` for fan-out, `appendAttempt` for retry tracking, `createTask` to spawn fan-out children from `poll-issues`. Existing `claude.ts` wrapper is reused with longer `timeoutMs` overrides per phase (triage 15 min, fix 45 min, verify 20 min, post-mortem 3 min).

**The one infrastructure question worth flagging during implementation:** the processor runs phases *synchronously* inside one `/api/cron` HTTP call. A 45-minute fix phase blocks the cron loop, queuing every other pipeline behind it. There's no processor-level "skip if already running" guard. For v1 this is acceptable because traffic is zero — at most one ticket per day, processed serially. If it becomes painful, the v2 fix is either (a) detach long phases as subprocesses with file-artifact polling, or (b) add a processor-level mutex. Both are core changes and out of scope for v1.

## Risks / Trade-offs

- **[Wrong-fix-passes-tests]** Bot writes a fix that compiles and passes `make ci` but doesn't actually address the bug. → *Mitigation:* verify gate requires a regression test in the diff AND a clean dev-repro re-run. Captain reviews every PR in draft state before flipping to ready.
- **[Repro succeeds via side effect]** Playwright catches "page errored" that's unrelated to the reported symptom. → *Mitigation:* repro agent must report `matchedSymptomFromIssue: true` and `evidence.consoleErrors`/`httpFailures` matching keywords from the issue body. Generic page errors without symptom-match → `reproduced: false`.
- **[Spec drift]** Investigate agent reads stale specs and "fixes" the bug to match the spec instead of the desired behavior. → *Mitigation:* `specs/**` is on the soft-ban list — any spec edit forces `needs_review`. Captain decides whether the spec needed updating.
- **[Cost runaway]** 4–6 claude calls per ticket × N tickets/day × Opus pricing = real money on a spam day. → *Mitigation:* `maxTicketsPerDay: 5`, kill-switch file, FIFO queueing past the cap. Token-cost analytics (v2) will close the observability loop.
- **[Bot user-data mismatch]** Real user with 17 saved jobs hits a pagination bug; bot's seeded user has 0–3 saved jobs and can't repro. → *Mitigation:* v1 seeds a moderately rich bot user (2 resumes, 3 saved jobs, search history); "can't repro" outcomes route to `needs_review` so the captain sees them. v2 may seed multiple bot personas (`bot-rich`, `bot-empty`, `bot-100jobs`).
- **[Dev-vs-prod divergence]** Bug only reproduces in prod (real LLM responses, real CDN, real JSearch results). v1 dev-only repro will say "cannot reproduce" → close. → *Mitigation:* close comment instructs the user to reopen if the bug persists, which becomes a v2-prod-target signal once that flips on.
- **[Selector brittleness in Playwright]** Bot uses `[name=email]`, rolenext refactors to `[data-testid=email-input]`. Repro fails for unrelated reasons. → *Mitigation:* repro agent prompt prioritizes text/role-based locators (`getByRole`, `getByLabel`) over CSS selectors. Brittle selectors get caught by the trace viewer when investigating.
- **[Concurrency = 1 means everything queues behind a slow fix]** A 45-min fix blocks the next ticket for 45 min. → *Mitigation:* acceptable at zero traffic; FIFO + 5/day cap means worst case is bounded. v2 raises concurrency once per-worktree Postgres isolation is in place.
- **[Bot floods PR reviews]** Captain reviews PR, bot pushes revision, captain reviews again, etc. → *Mitigation:* revision triggers only on new reviewer activity since last bot push; if the captain comments without leaving review comments, no revision fires. Plus 15-min poll cadence rate-limits the loop.
- **[Reopen interaction with attempt history]** User reopens issue, bot spawns new task with `attempt: 2`, but if user reopens again (attempt 3, 4, ...), unbounded loop. → *Mitigation:* `attempt > 3` auto-routes to `needs_review` regardless of agent confidence. Captain decides whether to keep trying or close.

## Migration Plan

This is a greenfield pipeline; nothing to migrate. Deployment is "register the pipeline, add the cron line, install Playwright, install gh, ensure GITHUB_PAT and bot creds are in env, run once with kill-switch ON to validate".

Rollback: comment out the cron line, set kill-switch file, in-flight tasks complete naturally or get auto-cleared by software-factory-housekeeping after 7 days.

## Open Questions

- **Marketing pipeline scan scope.** Does `vault-nuggets` currently scan `vault/**` or an explicit allowlist? If `vault/**`, we add a `type: incident` frontmatter filter; if allowlist, no change needed. *To be confirmed during task 23 implementation.*
- **GitHub PR ready-toggle CI triggering.** RoleNext's `.github/workflows/ci.yml` must include `ready_for_review` in its `pull_request` types for the draft→ready flow to fire CI. To be confirmed during PR-phase implementation; if missing, captain adds a one-line PR to rolenext OR we accept that CI also runs on `opened` (which fires for drafts too, depending on workflow config).
- **`COMPOSE_PROJECT_NAME` per worktree.** Confirmed-feasible based on docker compose docs, but the exact env var plumbing needs to be tested with rolenext's `docker-compose.yml`. Likely just `COMPOSE_PROJECT_NAME=rolenext-issue-${N} docker compose up -d`.
- **claude `-p` long-running stability.** A 45-min fix call is uncommon for the `-p` CLI. May need to switch to streamed/file-output mode if the wrapper's `maxBuffer` (10 MB) becomes a constraint. Bumping to 50 MB is cheap; flagged as a known constraint.
