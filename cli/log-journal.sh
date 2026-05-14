#!/usr/bin/env bash
# Write a build-journal entry directly to vault/build-journal/.
# Usage:
#   cli/log-journal.sh <project> <message>            # one-line entry
#   cli/log-journal.sh <project> --body                # multi-line: reads stdin until EOF
#
# Examples:
#   cli/log-journal.sh rolenext "Stripe live mode finally working after the webhook race fix"
#   cli/log-journal.sh rolenext --body < /tmp/dogfood-notes.md
#
# The entry lands as a tier-2, content_ready=false note that the nuggets
# extract phase can later mine for atomic notes. The captain can also edit
# the file directly.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <project> <message|--body>" >&2
  exit 2
fi

PROJECT="$1"
shift

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOURNAL_DIR="${VAULT_ROOT:-$ROOT/vault}/build-journal"
mkdir -p "$JOURNAL_DIR"

DATE="$(date -u +%Y-%m-%d)"
TS_SLUG="$(date -u +%Y-%m-%d_%H%M%S)"

if [[ "$1" == "--body" ]]; then
  TITLE="${TS_SLUG} ${PROJECT}"
  BODY="$(cat)"
else
  MESSAGE="$*"
  # Build a slug from the first ~6 words
  SLUG="$(echo "$MESSAGE" | tr '[:upper:]' '[:lower:]' | tr -c '[:alnum:]' '-' | tr -s '-' | sed 's/^-//;s/-$//' | cut -c1-60)"
  TITLE="${DATE}_${SLUG}"
  BODY="$MESSAGE"
fi

FILE="$JOURNAL_DIR/${TITLE}.md"

# If file exists, append a UID suffix
if [[ -e "$FILE" ]]; then
  FILE="$JOURNAL_DIR/${TITLE}-$(date +%s%N | tail -c 5).md"
fi

cat > "$FILE" <<EOF
---
pillar: build-journal
title: ${TITLE}
project: ${PROJECT}
tier: 2
content_ready: false
created: ${DATE}
tags: [${PROJECT}, journal]
aliases: []
---

${BODY}
EOF

echo "wrote $FILE"
