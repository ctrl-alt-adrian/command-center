# Vault

MACHINE-framework atomic-note knowledge base. Every downstream marketing,
competitors, and reddit-pmf phase reads from this directory. Per the
agentic-lab ride-along: "A pipeline reading from a thin vault writes
thin posts."

## Pillars (top-level directories)

| Pillar | Letter | What goes here |
|---|---|---|
| `mapping/` | M | Mental models, frameworks for thinking about systems |
| `agents/` | A | Subagent design, orchestration, separation-of-concerns rules |
| `context/` | C | Context engineering — what goes in the prompt, what stays out |
| `harness/` | H | Claude Code, hooks, slash commands, infrastructure |
| `intuition/` | I | Judgment about when to gate, retry, ship |
| `natural-language/` | N | Prompt craft, slop avoidance, writing rules |
| `engineering/` | E | Deterministic gates, file-based handoffs, backpressure, retry |
| `general/` | — | Cross-cutting notes |
| `mindset/` | — | Cultural / philosophical layer |
| `free-lunch/` | — | High-leverage moves, multiplicative wins |
| `youtube-videos/` | — | Per-video lessons, ideation archive |
| `build-journal/` | — | Project-specific log (RoleNext + others) |

## Atomic-note schema

Every `.md` file in any pillar must have YAML frontmatter:

```yaml
---
pillar: engineering           # one of the directory names above
title: Deterministic Gate     # human-readable, used as wikilink target
tier: 1                       # 1 = framework note (mined preferentially), 2/3 = supporting
content_ready: true           # true means a marketing phase can use it as-is
created: 2026-05-14
tags: [gate, pipeline, retry]
aliases: [det-gate]
---
```

Body starts with a one-sentence summary, followed by content, followed by:

```markdown
## Related

- [[Phase Output Path]]
- [[Backpressure Cap]]
```

## How content lands here

1. `pipelines/vault-nuggets/` scans `~/Documents/rolenext/sessions/` and
   `vault/build-journal/` daily at 9 AM, drafts candidate atomic notes
   via `claude -p`, dedupes against the live vault, stages survivors in
   `vault/.staging/<task-id>/` for captain review.
2. Captain approves in `/vault` — embed phase moves approved notes into
   the target pillar and creates wikilink stubs for missing targets.
3. Notes can also be added manually — `cli/log-journal.sh` writes
   directly to `build-journal/` without going through nugget review.

## Used by

- Marketing discovery / generate / refine all read exclusively from `$VAULT_ROOT`.
  Rolenext sessions are *raw material* the extract phase mines from; they are
  no longer a direct marketing source (cut to prevent duplicate-content risk
  between raw sessions and the refined notes extracted from them).
- Competitors and reddit-pmf pipelines (future) will read here too.

## Obsidian setup

The vault is Obsidian-compatible by design. To open it:

1. Obsidian → File → Open vault → `vault/` (this directory)
2. Obsidian will create a `.obsidian/` config dir inside; the dashboard's
   walker skips dotted dirs so it stays out of the live note index.
3. `vault/.staging/` (extract candidate JSON, dot-prefixed) is also skipped
   by Obsidian's indexer for the same reason.

Recommended Obsidian plugins for this vault:

- **Dataview** — query frontmatter (`tier`, `content_ready`, `pillar`) like
  a database; ideal for "show all tier-1 engineering notes ready for content"
- **Templater** — fill in frontmatter on manual note creation
- **Graph Analysis** — surface clusters and bridges in the wikilink network

The dashboard and Obsidian are complementary: use the dashboard for ingest
workflows (extract → review → embed) and Obsidian for browsing, editing,
graph view, and backlinks.

### One gotcha

The embed phase writes `.md` files programmatically when you finalize a
staging review. If you're editing the same file in Obsidian when embed runs,
last-write-wins. Save in Obsidian before clicking *Embed approved*.

## Local-only

The vault is `.gitignore`'d. Notes contain personal/proprietary content
(alpha-user names, internal incident details). Only the directory layout
and Map-of-Content stubs are tracked.
