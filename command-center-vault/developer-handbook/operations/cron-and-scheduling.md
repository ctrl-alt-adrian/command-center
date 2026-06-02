# Operations — Cron & Scheduling

Command Center has no background daemon. Everything is driven by OS cron lines
that `curl` the dashboard. This page decodes every line in `cron/cron.txt` and
explains the two roles a cron line can play.

## cron syntax refresher

A crontab line is five time fields followed by the command:

```
┌───────────── minute       (0–59)
│ ┌───────────── hour        (0–23)
│ │ ┌───────────── day-of-month (1–31)
│ │ │ ┌───────────── month     (1–12)
│ │ │ │ ┌───────────── day-of-week (0–7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *  command
```

`*` = every value; `*/15` = every 15th; a single number = exactly that value.

## The two roles a line plays

1. **The processor heartbeat.** `POST /api/cron` runs one `runProcessor()` tick
   (resume → dispatch → run phases → eval gates). This is the *engine*. It runs
   every minute and does **not** create new top-of-pipeline tasks — it only
   advances tasks that already exist.
2. **Pipeline triggers.** `POST /api/tasks {pipelineId}` enqueues one fresh
   top-of-pipeline task for that pipeline. The next heartbeat picks it up. These
   are the *alarm clocks* — daily/weekly schedules that kick a pipeline off.

So: triggers create work; the heartbeat does the work.

## Every line in `cron/cron.txt`, decoded

The file header notes it is managed by `setup.sh` — lines containing
`command-center` are replaced on install (that's how re-running setup stays
idempotent; see [../03-getting-started.md](../03-getting-started.md)).

### Active lines

| Schedule | Decode | What it does | Pipeline |
|---|---|---|---|
| `* * * * *` | every minute | `POST /api/cron` — the processor heartbeat | (engine — [../core/03-processor.md](../core/03-processor.md)) |
| `0 9 * * *` | 09:00 daily | `POST /api/tasks {"pipelineId":"vault-nuggets"}` | [vault-nuggets](../pipelines/vault-nuggets.md) |
| `0 10 * * *` | 10:00 daily | `POST /api/tasks {"pipelineId":"competitors"}` (yt-dlp scrape) | [competitors](../pipelines/competitors.md) |
| `0 8 * * 1` | 08:00 every Monday | `POST /api/tasks {"pipelineId":"reddit-pmf"}` | [reddit-pmf](../pipelines/reddit-pmf.md) |
| `0 17 * * 5` | 17:00 every Friday | `POST /api/tasks {"pipelineId":"reddit-pmf-metrics"}` (writes a stub) | [reddit-pmf](../pipelines/reddit-pmf.md) |
| `0 3 * * *` | 03:00 daily | `POST /api/tasks {"pipelineId":"software-factory-housekeeping"}` | [software-factory](../pipelines/software-factory.md) |
| `*/15 * * * *` | every 15 minutes | `POST /api/tasks {"pipelineId":"rolenext-bug-resolver"}` (poll GitHub) | [rolenext-bug-resolver](../pipelines/rolenext-bug-resolver.md) |

The exact heartbeat line:

```
* * * * * curl -s -X POST http://localhost:3001/api/cron > /dev/null 2>&1  # command-center processor
```

A representative trigger line:

```
0 9 * * * curl -s -X POST http://localhost:3001/api/tasks -H 'content-type: application/json' -d '{"pipelineId":"vault-nuggets"}' > /dev/null 2>&1  # command-center vault-nuggets extract
```

### Commented-out lines (the marketing block)

```
# 0 10 * * * /home/adrian/Developer/projects/command-center/cron/fetch-signals.sh ...  # command-center marketing signals
# 0 11 * * * curl ... -d '{"pipelineId":"marketing"}' ...                              # command-center marketing discovery
```

Both marketing lines are **commented out**. The file explains why:

> Marketing pipeline. Still manual on command-center; marketing-pipeline at
> :3000 still owns these slots.
>
> — `cron/cron.txt:4`

So marketing on command-center is triggered manually for now (`POST /api/tasks
{"pipelineId":"marketing"}`) to avoid both systems fighting for the 10:00 / 11:00
slots. Uncomment these only after cutting marketing over from the legacy :3000
system.

### Pipelines with no cron line

`rolenext-job-apply` and `personal-brand` are registered but have **no** cron
entry — they're triggered on demand from their dashboard pages or via a manual
`POST /api/tasks`.

## `cron/fetch-signals.sh` is a no-op stub

The marketing `0 10` line (commented out) would run `cron/fetch-signals.sh`. That
script is intentionally a no-op:

```bash
# cron/fetch-signals.sh
# NOTE: scaffolded but not active. The actual scraper scripts ... live in the
# old marketing-pipeline repo ...
# Today this script is a no-op so it can be uncommented in cron.txt without erroring.
set -euo pipefail
echo "[$(date)] command-center fetch-signals: not yet active (see cron/fetch-signals.sh)" >&2
exit 0
```

To make it real you'd either port the python fetchers into
`pipelines/marketing/scripts/` or point the script at the existing
marketing-pipeline `scripts/` directory (both options are spelled out in the
script's header comment).

## Installing / inspecting the crontab

`setup.sh` installs these lines (idempotently — see
[../03-getting-started.md](../03-getting-started.md)). To inspect or edit the
live crontab manually:

```bash
crontab -l          # list installed entries
crontab -e          # edit
```

The OS cron daemon must be running for any of this to fire. If the **dashboard**
is down when a line fires, the curl just fails silently (`2>&1` to `/dev/null`) —
there is no alarm. See [troubleshooting.md](troubleshooting.md).

## See also
- [../core/03-processor.md](../core/03-processor.md) — what a heartbeat tick does.
- [configuration.md](configuration.md) — `PORT` (the curl target) and caps.
- [troubleshooting.md](troubleshooting.md) — silent-failure modes.
