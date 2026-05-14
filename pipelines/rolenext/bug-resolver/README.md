# RoleNext bug resolver

Autonomous pipeline that polls open GitHub issues on rolenext, triages each with a code-investigation agent, attempts a fix in an isolated git worktree, verifies it (write-policy + regression test + `make ci`), and opens a draft PR for the captain to review and merge.

Lives in the `rolenext` namespace (separate from `software-factory`, which is reserved for command-center maintaining itself). First pipeline in this namespace; future rolenext-specific automation (deploy monitors, changelog generation, etc.) lives alongside.

## v1 vs v1.1

**v1 (this milestone):** investigate-only triage. No Playwright. No `make db`. No bot user. No rolenext repo changes.

**v1.1 (deferred, behind `enableBrowserRepro: true`):** Playwright + headless browser repro + dev-server startup + bot-user fixtures (`rolenext/scripts/seed-bot-user.sh`) + dev-repro re-run as a fourth verify check.

Flip the flag in `pipeline.config.ts`'s `ROLENEXT_BUG_RESOLVER_CONFIG`. The config carries `enableBrowserRepro: false` by default.

## The seven phases

```
poll-issues  →  triage  →  write-handoff  →  fix  →  verify  →  pr  →  post-mortem
```

| phase | gate | what it does |
|---|---|---|
| `poll-issues` | auto_pass + fanOut | Polls GitHub issues + open bot-PRs. Applies 3-layer dedup. Spawns one triage task per surviving issue. Spawns revision tasks when new reviewer activity exists on a bot-PR. |
| `triage` | deterministic | Creates worktree from `origin/main`, runs investigate agent (claude `-p` with spec-map context), persists `investigate.json`. Gate: advance if `fixKnown && confidence > triageThreshold`; close issue with auto-comment + `needs_review` if `noBugFound`; else `needs_review`. |
| `write-handoff` | auto_pass | Composes `handoff.md` from `investigate.json`. |
| `fix` | auto_pass | **Open mode:** recreates worktree, runs fix agent (claude `-p` with handoff, in worktree cwd), commits. Agent decomposes multi-file fixes into subagents per concern. **Revision mode:** checks out PR branch, pulls line-level review comments via `gh api`, runs fix-revision agent, commits new commit on top. |
| `verify` | deterministic | Three checks in v1 (write-policy diff scan, regression-test presence, `make ci`). Owns the fix-retry loop: on CI failure with policy/regression clean, appends failure log to handoff, re-invokes fix agent in-place, re-runs checks (up to `fixRetries` more times). Soft-ban paths recorded for PR phase, NOT a gate. |
| `pr` | auto_pass | **Open mode:** pushes branch, `gh pr create --draft`, full structured body (Closes #N, soft-ban callout if any, root cause, fix summary, verification checklist, handoff in `<details>`), labels `bot-fix, bug, auto-triaged` (+ `bot-touched-soft-banned` when applicable), captain as assignee + reviewer. **Revision mode:** pushes commit, flips PR back to draft, posts `"🤖 pushed revision addressing review"` comment. |
| `post-mortem` | auto_pass | Writes structured markdown to `vault/incidents/<date>_issue-<N>_<slug>/post-mortem.md` with YAML frontmatter (taxonomy: featureArea, rootCauseClass, status, durationMinutes, fixRetryCount, etc.). Archives `handoff.md`. Tears down worktree. |

## Dedup contract

```
LAYER 1: task store
  any task for this issue with non-terminal status → skip

LAYER 2: GitHub state
  issue closed                            → skip
  issue has linked PR (open or merged)    → skip
  issue has wontfix | duplicate | no-bot  → skip

LAYER 3: fingerprint  (sha256(normalizedPageUrl :: first200char(normalizedDesc)))
  fp match within 14-day window AND matched issue's PR open/merged
    → label `bot-skipped` + `duplicate-of-<N>`, skip
```

Reopens (`state_reason: "reopened"`) bypass Layer 1, get `attempt: <prev + 1>`, and triage forces `needs_review` (captain decides whether to retry). Reopens beyond attempt 3 land in `needs_review` immediately with reason `"reopen attempt limit exceeded"`.

## Write policy

| category | paths | behavior |
|---|---|---|
| hard-ban | `*.env`, `*.env.*`, `backend/db/migrations/**`, `.github/**` | verify gate blocks → `needs_review` |
| soft-ban | `specs/**`, `docker-compose.yml`, `Makefile`, `package.json`, `pnpm-lock.yaml`, `go.mod`, `go.sum`, `go.work*`, `frontend/vite.config.ts`, `frontend/vitest.config.ts` | does NOT block; PR receives label `bot-touched-soft-banned` + `⚠️ Soft-ban paths touched` callout in body |
| free | everything else | proceeds to PR without callout |

Captain reviews every PR — the PR review IS the human gate for soft-ban-category changes.

## Throughput caps

| cap | default | meaning |
|---|---|---|
| `maxTicketsPerDay` | 5 | UTC day; over-cap issues get labeled `bot-deferred` and skipped |
| `maxQueueDepth` | 20 | total active tasks (pending + running + needs_review + paused); overflow creates a sentinel `needs_review` task |
| `ticketStaleAfterDays` | 7 | pending tasks past this auto-escalate to `needs_review` with reason `"queued > 7 days, bot bandwidth"` |
| `concurrency` | 1 | one worktree active at a time (raise once per-worktree Postgres isolation is in place) |
| `killSwitchFile` | `.disabled` | filename in `state/`; when present, poll phase is a no-op |

## Kill switch

To pause the pipeline temporarily without changing config or cron:

```bash
touch pipelines/rolenext/bug-resolver/state/.disabled
```

To resume:

```bash
rm pipelines/rolenext/bug-resolver/state/.disabled
```

The poll phase checks the file on every run; in-flight tasks complete naturally.

## Revision flow

Two ways to trigger a revision:

1. **Automatic (every 15 min)** — `poll-issues` scans open bot-PRs. If new non-bot reviewer activity is newer than the PR's last update, a `phaseId: "fix"` task with `mode: "revision"` is spawned.
2. **Manual ("Revise now" button)** — on the dashboard task-detail page, captain clicks the button (visible only when the task has an open PR), optionally adds a high-level note, and the dashboard POSTs `/api/tasks` + `/api/cron` to dispatch immediately.

Both paths converge on the same `fix` revision-mode agent, which automatically pulls line-level PR comments via `gh api` and feeds them to claude alongside the captain's high-level note.

## Status

```bash
npx tsx cli/bug-resolver-status.ts
```

Shows config, kill-switch state, daily counter, queue depth, task counts by status, recent fingerprints.

## Required env

| var | required when | what for |
|---|---|---|
| `GITHUB_TOKEN` or `gh auth` configured | always | `gh` CLI shells out for issue/PR operations |
| `ROLENEXT_PATH` | only if rolenext repo lives elsewhere than default | overridable via `pipeline.config.ts`'s `rolenextPath` |
| `BOT_EMAIL`, `BOT_PASSWORD` | **v1.1 only** (when `enableBrowserRepro: true`) | dev DB bot user credentials |

## Vault layout convention

Post-mortems live in `vault/incidents/<YYYY-MM-DD>_issue-<N>_<slug>/`. This directory is **NOT** in `core/lib/vault.ts`'s `PILLARS` allowlist, so the marketing-pipeline and vault-nuggets ingestion paths ignore it automatically — no extra filter needed. Each incident dir contains:

- `post-mortem.md` (frontmatter + body)
- `handoff.md` (archived)
- `trace.zip` (v1.1 only — Playwright trace)

## Installation

1. `npm install` at repo root (no new dependencies for v1)
2. `gh` CLI installed and authenticated (`gh auth status` should succeed)
3. `git` configured with push access to the rolenext remote
4. Cron line already in `cron/cron.txt` — re-run `setup.sh` to install it
5. Optional first run with the kill-switch on:
   ```bash
   touch pipelines/rolenext/bug-resolver/state/.disabled
   curl -X POST http://localhost:3001/api/tasks -d '{"pipelineId":"rolenext-bug-resolver"}'
   # check the dashboard at /rolenext/bug-resolver
   rm pipelines/rolenext/bug-resolver/state/.disabled
   ```

## v1.1 (parked)

- Playwright + headless browser repro (`enableBrowserRepro: true`)
- `rolenext/scripts/seed-bot-user.sh` (one bot user with 2 resumes, 3 saved jobs, search history)
- `make db` + dev-server startup per worktree
- Dev-repro re-run as fourth verify check
- Per-issue Playwright `trace.zip` attached to incidents

## v2 (parking lot)

- Prod-targeted repro (`reproTarget: "prod"` + prod bot account)
- Meta-agent for triage tie-breaking on ambiguous cases
- True fail-before-pass-after regression-test semantics (currently presence-only)
- `tokensUsed` analytics (needs `claude -p` wrapper to expose usage)
- Layer-4 semantic-similarity dedup (currently deterministic only)
- Bot auto-iterates on PR review via webhook (currently 15-min poll OR manual button)
- Severity-priority ordering (waits for support widget priority field)
