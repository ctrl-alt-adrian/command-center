# Operations — Configuration

Every environment variable Command Center reads, where it's read, and what
happens when it's unset. The canonical reference is `.env.example` at the repo
root; this page documents that file **plus** vars read in code but not listed
there.

## How config is loaded

There is no dotenv dependency wired into the runtime. Instead,
`dashboard/src/hooks.server.ts` reads the repo-root `.env` and seeds
`process.env` once, at server startup:

```ts
// dashboard/src/hooks.server.ts
loadRootDotenv();
bootstrapPipelines();
```

Key rules from that loader:

- It reads `../../.env` relative to `hooks.server.ts` — i.e. the **repo-root**
  `.env`, not `dashboard/.env`.
- Lines starting with `#` and blank lines are skipped.
- **Shell-exported vars win.** `if (process.env[key] !== undefined) continue;` —
  a value already in the environment is never overwritten by the file.
- Surrounding single or double quotes are stripped from values.

If `.env` is missing the loader silently returns; all vars fall back to their
in-code defaults.

## Variables in `.env.example`

### `COMMAND_CENTER_ROOT`
- **Default:** the repo root, computed in `paths.ts` as
  `path.resolve(import.meta.dirname ?? __dirname, "..", "..")`.
- **Purpose:** the base directory under which `tasks/`, `signals/`, `drafts/`,
  `vault/`, and `logs/` resolve. Set it explicitly if you ever run the process
  from an unexpected working directory.

### `VAULT_ROOT`
- **Default:** `path.join(COMMAND_CENTER_ROOT, "vault")` (see `paths.ts`).
- **Purpose:** root of the MACHINE-framework atomic-note knowledge base read by
  `core/lib/vault.ts`. See [../vault/01-machine-framework.md](../vault/01-machine-framework.md).

### `LEGACY_SESSIONS_ROOT`
- **Default:** `~/Documents/rolenext/sessions` (`paths.ts`:
  `path.join(process.env.HOME ?? "", "Documents", "rolenext", "sessions")`).
- **Purpose:** the legacy sessions corpus — the marketing pipeline's older KB.
  Read-only fallback used by marketing.

### `PORT`
- **Default:** 3001 (and the dashboard dev server / cron all assume 3001).
- **Purpose:** dashboard HTTP port. 3001 is deliberate so command-center can run
  alongside the legacy marketing-pipeline on :3000.

### `PROCESSOR_PER_TICK_CAP`
- **`.env.example` value:** `3`.
- **In-code default if unset:** `10` — `DEFAULT_PROCESSOR_PER_TICK_CAP` in
  `core/lib/types.ts:110`. Note the mismatch: the shipped `.env.example` tunes it
  down to 3, but if you have no `.env` the runtime uses 10.
- **Purpose:** the maximum number of pending tasks dispatched per `/api/cron`
  tick for pipelines that **don't** declare their own `perTickCap`. Pipelines
  with a `perTickCap` override run on their own independent budget. Read in
  `processor.ts`:

  ```ts
  // core/lib/processor.ts:30
  function globalPerTickCap(): number {
    const raw = process.env.PROCESSOR_PER_TICK_CAP;
    if (!raw) return DEFAULT_PROCESSOR_PER_TICK_CAP;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROCESSOR_PER_TICK_CAP;
  }
  ```

  Per-pipeline overrides currently in the configs: `software-factory-housekeeping:
  50`, `marketing: 25`, `competitors: 5`, `rolenext-bug-resolver: 5`,
  `rolenext-job-apply: 3`, `vault-nuggets: 1`. See
  [../core/03-processor.md](../core/03-processor.md).

### `REDDIT_USER_AGENT`
- **Default:** none — but it's the only **hard requirement** for the reddit-pmf
  pipeline. Public reddit JSON works without OAuth; reddit just demands a User-Agent.
- **`.env.example` value:** `command-center-reddit-pmf/0.1 (by /u/your-handle)` —
  replace the handle.

### `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`
- **Default:** unset (commented out in `.env.example`).
- **Purpose:** optional reddit OAuth. Only fill these in if you hit rate limits
  on the public JSON endpoints. See [../pipelines/reddit-pmf.md](../pipelines/reddit-pmf.md).

### `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `LANDING_REPO_PATH`
- **Default:** unset (commented out).
- **Purpose:** the reddit-pmf landing-page deploy. **If unset, the deploy phase
  runs dry-run** — it only writes content files locally to
  `signals/reddit-pmf/<date>/<cluster>/`. Note the actual Vercel push is
  documented-but-**not-implemented** today (deploy is dry-run only regardless).
  See [../pipelines/reddit-pmf.md](../pipelines/reddit-pmf.md).
  - `LANDING_REPO_PATH` would point at a separate landing-template repo.

### `ROLENEXT_API_BASE`
- **`.env.example` value:** `http://localhost:8080`.
- **Purpose:** base URL for the RoleNext API used by the job-apply pipeline.

### `ROLENEXT_JWT`
- **Default:** unset (commented out).
- **Purpose:** auth for the rolenext-job-apply pipeline — a Clerk session token.
  Per `.env.example`, extract it via
  `await window.Clerk.session.getToken()` in DevTools after logging into
  rolenext. Default-template tokens last ~60s; create a long-TTL JWT template in
  the Clerk dashboard for hour-long sessions. The job-apply pipeline **needs**
  this. See [../pipelines/rolenext-job-apply.md](../pipelines/rolenext-job-apply.md).

## Variables read in code but NOT in `.env.example`

### `CLAUDE_CONCURRENCY`
- **Default:** `8` — `core/lib/claude.ts`.
- **Purpose:** the size of the in-process semaphore that bounds how many `claude
  -p` child processes run concurrently across the whole app. This is the real
  ceiling on Anthropic API concurrency (the processor's per-tick cap bounds *task
  dispatch*, not claude calls). Read at module load:

  ```ts
  // core/lib/claude.ts:34
  const CLAUDE_CONCURRENCY = (() => {
    const raw = process.env.CLAUDE_CONCURRENCY;
    if (!raw) return 8;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 8;
  })();
  ```

  Because it's read once at module load, changing it requires a dashboard
  restart. See [../core/06-claude-wrapper.md](../core/06-claude-wrapper.md).

### The default Claude model
- Not an env var — it's a code default. Every `claude()` call uses
  `claude-sonnet-4-6` unless the caller passes a `model`:

  ```ts
  // core/lib/claude.ts:77
  const model = resolved.model ?? "claude-sonnet-4-6";
  ```

  To change the default model globally you edit this line. Individual phases can
  override per-call by passing a model string/options (e.g. a cheaper model for
  bulk extraction). The CLI is invoked as
  `claude -p --setting-sources <project|user|all> --model <model>`.

## Quick reference table

| Var | Default | Where read |
|---|---|---|
| `COMMAND_CENTER_ROOT` | repo root | `core/lib/paths.ts` |
| `VAULT_ROOT` | `$ROOT/vault` | `core/lib/paths.ts` |
| `LEGACY_SESSIONS_ROOT` | `~/Documents/rolenext/sessions` | `core/lib/paths.ts` |
| `PORT` | 3001 | dashboard / cron |
| `PROCESSOR_PER_TICK_CAP` | 3 (`.env.example`) / 10 (code) | `core/lib/processor.ts` |
| `REDDIT_USER_AGENT` | required for reddit-pmf | reddit-pmf lib |
| `REDDIT_CLIENT_ID` / `_SECRET` | unset (optional OAuth) | reddit-pmf lib |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `LANDING_REPO_PATH` | unset (dry-run) | reddit-pmf deploy |
| `ROLENEXT_API_BASE` | `http://localhost:8080` | rolenext libs |
| `ROLENEXT_JWT` | unset (required for job-apply) | rolenext-job-apply lib |
| `CLAUDE_CONCURRENCY` | 8 | `core/lib/claude.ts` |
| (model) `claude-sonnet-4-6` | code default | `core/lib/claude.ts` |

## See also
- [cron-and-scheduling.md](cron-and-scheduling.md) — what each schedule triggers.
- [troubleshooting.md](troubleshooting.md) — config-related failure modes.
- [../03-getting-started.md](../03-getting-started.md) — initial setup.
