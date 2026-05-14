#!/usr/bin/env bash
# command-center · marketing · fetch-signals
# Schedule: 0 10 * * * (1hr before discovery)
#
# NOTE: scaffolded but not active. The actual scraper scripts (python fetchers
# for GitHub Trending, Hacker News, Dev.to) live in the old marketing-pipeline
# repo at /home/adrian/Developer/projects/marketing-pipeline/scripts/.
# To activate signals in command-center, either:
#   (a) port the python fetchers into command-center/pipelines/marketing/scripts/, or
#   (b) point this script at the existing marketing-pipeline scripts/ directory.
#
# Today this script is a no-op so it can be uncommented in cron.txt without erroring.
set -euo pipefail
echo "[$(date)] command-center fetch-signals: not yet active (see cron/fetch-signals.sh)" >&2
exit 0
