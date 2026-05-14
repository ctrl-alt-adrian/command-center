## Why

RoleNext's in-app support widget already creates GitHub Issues for every authenticated bug report (per `rolenext/specs/support-channel.md`). Today those issues sit in the queue until a human picks them up. We want an autonomous local pipeline — the first inhabitant of a new `rolenext` namespace (separate from `software-factory`, which is reserved for command-center maintaining itself) — that polls those issues, triages each one with parallel browser-repro + code-investigation agents, attempts a fix in an isolated git worktree, verifies it (CI + dev repro re-run + regression-test check + write-policy diff scan), and opens a **draft** PR for the captain to review and merge.

Pre-alpha is the right time: traffic is zero, so we can build, calibrate confidence thresholds, and graduate to higher autonomy once the alpha lands.

## What Changes

- **New pipeline** `rolenext-bug-resolver` under `pipelines/rolenext/`, registered with the core processor and driven by an existing `*/15 * * * *` cron poke.
- **Linear 7-phase flow** — `poll-issues → triage → write-handoff → fix → verify → pr → post-mortem` — with parallelism inside `triage` (parallel-capable when browser repro is enabled) and inside `verify` (write-policy scan, regression-test check, `make ci`).
- **v1 ships investigate-only triage.** The browser-repro branch is **opt-in via `enableBrowserRepro: false`** (default off in v1). Triage gate runs the investigate agent only and advances on `investigate.fixKnown && confidence > threshold`. The full Playwright/repro path is a deferred **v1.1 enablement** behind the flag, scoped to land only if stability proves out. This follows the session-9 "prune the nice-to-have" guidance.
- **Deterministic 3-layer dedup** (task-store / GitHub-state / pageUrl+description fingerprint). No semantic similarity in v1.
- **Per-task isolated worktree** branched from `origin/main` (never local main), torn down on completion.
- **Structured-JSON agent outputs** with confidence scores; deterministic gate at 0.7 threshold. Meta-agent tie-breaking parked for v2.
- **Two-tier write policy** at the verify gate:
  - **hard-banned** paths (secrets, migrations, CI workflows) → block at the verify gate, route to `needs_review`
  - **soft-banned** paths (specs, build configs, dep manifests) → do NOT block; the PR opens with label `bot-touched-soft-banned` and a `⚠️ Soft-ban paths touched` callout in the body. PR review is the single human gate for this category.
- **Fix agent decomposes multi-file fixes via subagents** — one subagent per file/concern, each with an isolated context window (matches session-9 "one task, one context window"). The fix agent coordinates and assembles the regression test.
- **Draft PRs only** with `Closes #N`, captain as sole reviewer, manual merge. **Revision loop** triggered automatically (next 15-min poll detects new review comments) or manually via a dashboard "Revise now" button.
- **Throughput caps**: 5 tickets/day (UTC), 20-deep queue, 7-day staleness escalation, concurrency 1, kill-switch file.
- **Structured post-mortems** with frontmatter taxonomy land in a new top-level `vault/incidents/` directory; surfaced on the dashboard via the markdown renderer already added in the previous KB work.
- **No changes to `core/lib/`.** The whole feature lives at the pipeline + dashboard layer; the processor's existing phase/gate semantics are sufficient.

### Deferred to v1.1 (behind `enableBrowserRepro: true`)

- Playwright (headless, trace always on) repro agent for triage
- Post-fix dev repro re-run as a fourth verify check
- `rolenext/scripts/seed-bot-user.sh` and the rich bot-user fixture set
- `make db` / dev-server startup per worktree
- Repro-evidence section in handoff / PR body

## Capabilities

### New Capabilities

- `rolenext-bug-resolver`: autonomous polling/triage/fix/verify/PR/post-mortem pipeline for GitHub Issues filed against the rolenext repo. Defines the abstract bug-fix loop, the deterministic gate behaviors, the dedup contract, the write-policy contract, the revision-flow contract, the throughput caps, and the post-mortem schema.

### Modified Capabilities

<!-- None. No existing capability specs in openspec/specs/. -->

## Impact

- **New code**: `pipelines/rolenext/bug-resolver/` (config + lib + prompts + README).
- **New dashboard routes** under `dashboard/src/routes/rolenext/bug-resolver/` (index + task detail). Re-uses the markdown renderer added in the previous KB work.
- **New vault dir**: `vault/incidents/` (post-mortems live here, NOT in marketing-mined KB dirs).
- **One new cron line** in `cron/cron.txt` (`*/15 * * * *` poll).
- **Possible touch to marketing/vault-nuggets pipeline**: only if it currently scans `vault/**` rather than an explicit allowlist — in that case add a `type: incident` frontmatter filter to skip post-mortems.
- **GitHub API usage**: `gh` CLI required on the host that runs the cron; PAT scope already exists (rolenext's support widget uses one for issue creation).
- **No breaking changes.** Existing pipelines, processor, and core unchanged.
- **Deferred to v1.1 (Playwright-enabled):**
  - `playwright` added to `package.json`, `playwright install chromium`
  - One additive change to rolenext: `scripts/seed-bot-user.sh`
  - Bot user credentials in env vars (`BOT_EMAIL`, `BOT_PASSWORD`)
