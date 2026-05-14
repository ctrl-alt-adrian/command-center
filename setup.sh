#!/usr/bin/env bash
# Command Center setup. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Installing dashboard deps"
(cd dashboard && npm install)

echo "==> Ensuring data directories exist"
mkdir -p tasks signals drafts vault logs logs/housekeeping

echo "==> Installing cron entries (idempotent)"
CRON_FILE="$ROOT/cron/cron.txt"
if [[ ! -f "$CRON_FILE" ]]; then
  echo "  no $CRON_FILE — skipping"
else
  TMP="$(mktemp)"
  crontab -l 2>/dev/null | grep -v 'command-center' > "$TMP" || true
  cat "$CRON_FILE" >> "$TMP"
  crontab "$TMP"
  rm -f "$TMP"
  echo "  installed entries from $CRON_FILE"
fi

echo
echo "==> Done."
echo "Next:"
echo "  cd dashboard && npm run dev   # http://localhost:3001"
echo "  curl -X POST http://localhost:3001/api/tasks -d '{\"pipelineId\":\"test-pipeline\"}'"
