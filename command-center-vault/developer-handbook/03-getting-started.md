# 03 — Getting Started

This page gets you from a fresh checkout to a running dashboard, and documents
the dev loop you'll use every day.

## Required tools on PATH

Command Center shells out to external CLIs. These must be installed and
resolvable on the `PATH` of whatever process runs the dashboard:

| Tool | Used by | Notes |
|---|---|---|
| `claude` | every `claude -p` phase (`core/lib/claude.ts`) | The big one. If it's not on PATH, all generative phases fail. See the PATH caveat in [operations/troubleshooting.md](operations/troubleshooting.md). |
| `yt-dlp` | the competitors pipeline scrape | [pipelines/competitors.md](pipelines/competitors.md) |
| `gh` | rolenext-bug-resolver (GitHub issues/PRs) | [pipelines/rolenext-bug-resolver.md](pipelines/rolenext-bug-resolver.md) |
| `git` | software factory / pipelines that touch repos | |
| `crontab` | `setup.sh` cron install + the heartbeat | The OS cron daemon must be running. |

Plus **Node** (the project was built against Node 25.9 via mise) and **npm** for
the dashboard. The backend is TypeScript on Node with `type: module` and
explicit `.ts` import extensions — see
[primers/typescript-node-primer.md](primers/typescript-node-primer.md).

## One-shot setup: `setup.sh`

`setup.sh` is idempotent — safe to re-run. It does three things:

```bash
# setup.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Installing dashboard deps"
(cd dashboard && npm install)

echo "==> Ensuring data directories exist"
mkdir -p tasks signals drafts vault logs logs/housekeeping

echo "==> Installing cron entries (idempotent)"
# ... see below
```

Step by step:

1. **`npm install` in `dashboard/`** — installs the SvelteKit/Svelte/Tailwind/Vite
   toolchain. All app dependencies live under `dashboard/`; the repo root has no
   `package.json` install step.
2. **Create the data directories** — `tasks signals drafts vault logs
   logs/housekeeping`. These are the on-disk data model (see
   [02-architecture.md](02-architecture.md)). `mkdir -p` is a no-op if they
   already exist.
3. **Install cron entries (idempotent)** — copies `cron/cron.txt` into the user
   crontab. The idempotency trick: it strips every existing line containing
   `command-center`, then re-appends the file:

   ```bash
   # setup.sh
   crontab -l 2>/dev/null | grep -v 'command-center' > "$TMP" || true
   cat "$CRON_FILE" >> "$TMP"
   crontab "$TMP"
   ```

   So re-running setup never duplicates cron lines. Every managed line in
   `cron/cron.txt` carries a trailing `# command-center ...` comment so the
   `grep -v` matches it. The full cron decode is in
   [operations/cron-and-scheduling.md](operations/cron-and-scheduling.md).

Run it:

```bash
bash setup.sh
```

It prints the next steps and exits.

## Run the dashboard

```bash
cd dashboard && npm run dev
```

Then open **http://localhost:3001**. The processor doesn't run on its own — it
runs when something `POST`s `/api/cron`. In normal operation the every-minute
cron line does that. While developing you can fire a tick yourself:

```bash
curl -s -X POST http://localhost:3001/api/cron
```

The main operational view is **`/tasks`** — it lists tasks, surfaces the
processor state banner, and exposes the captain actions (approve, reject,
rerun-gate, resume batches, enable/disable pipelines).

The dashboard port comes from `PORT` (default 3001 — chosen to coexist with the
legacy marketing-pipeline on :3000). See
[operations/configuration.md](operations/configuration.md).

## The type-check gate

There is no separate test runner wired as a gate; the quality gate is the
TypeScript / Svelte type-check:

```bash
cd dashboard && npm run check
```

This runs `svelte-check`. Treat **0 errors, 0 warnings** as the bar before you
commit (the codebase was last handed off clean across ~400 files). See
[best-practices/testing.md](best-practices/testing.md) and
[best-practices/coding.md](best-practices/coding.md).

## Environment variables

Copy the example and fill in what you need:

```bash
cp .env.example .env
```

`hooks.server.ts` loads the root `.env` into `process.env` on server boot (shell
exports win over file values). **Every** variable — including ones read in code
but not listed in `.env.example` like `CLAUDE_CONCURRENCY` — is documented in
[operations/configuration.md](operations/configuration.md). Read that page before
running any pipeline that talks to an external service (reddit, vercel, rolenext).

## Daily dev loop, summarized

1. `cd dashboard && npm run dev` → http://localhost:3001
2. Make changes in `core/lib/`, `pipelines/<name>/`, or `dashboard/`.
3. Exercise a tick: `curl -s -X POST http://localhost:3001/api/cron` (or wait for cron).
4. Watch `/tasks` and `logs/processor-<date>.log`.
5. `npm run check` before committing.

## Where to go next

- What every env var does: [operations/configuration.md](operations/configuration.md).
- When something breaks: [operations/troubleshooting.md](operations/troubleshooting.md).
- Add a pipeline: [pipelines/00-index.md](pipelines/00-index.md).
