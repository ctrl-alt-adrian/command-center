# The Vault: MACHINE-Framework Knowledge Base

The vault is an **atomic-note knowledge base** living at `vault/` in the repo
root. It is Obsidian-compatible (one idea per `.md` file, `[[Wikilink]]`
backlinks, YAML frontmatter) and is the source-of-truth that every downstream
content pipeline mines. Per the README's framing:

> "A pipeline reading from a thin vault writes thin posts."

That single line is the whole reason this thing exists. Marketing, personal
brand, competitors, and reddit-pmf phases never read raw session logs anymore —
they read *refined* atomic notes from here. If the vault is rich, the posts are
rich. See [02-how-content-lands.md](./02-how-content-lands.md) for how notes get
in, and [../core/09-vault-reader.md](../core/09-vault-reader.md) for the reader
library (`core/lib/vault.ts`) that parses everything below.

---

## The MACHINE acronym

The first seven pillars spell **MACHINE**. Each pillar is a top-level directory
under `vault/`, and the directory name *is* the canonical pillar slug used in
code (`core/lib/vault.ts:7`).

| Letter | Pillar dir | What goes here |
|:--:|---|---|
| **M** | `mapping/` | Mental models, frameworks for thinking about systems |
| **A** | `agents/` | Subagent design, orchestration, separation-of-concerns rules |
| **C** | `context/` | Context engineering — what goes in the prompt, what stays out |
| **H** | `harness/` | Claude Code, hooks, slash commands, infrastructure |
| **I** | `intuition/` | Judgment about when to gate, retry, ship |
| **N** | `natural-language/` | Prompt craft, slop avoidance, writing rules |
| **E** | `engineering/` | Deterministic gates, file-based handoffs, backpressure, retry |

### Extra pillars (not part of the acronym)

Five more directories sit alongside MACHINE for cross-cutting and archival
material:

| Pillar dir | What goes here |
|---|---|
| `general/` | Cross-cutting notes that don't fit one MACHINE letter |
| `mindset/` | Cultural / philosophical layer |
| `free-lunch/` | High-leverage moves, multiplicative wins |
| `youtube-videos/` | Per-video lessons, ideation archive |
| `build-journal/` | Project-specific log (RoleNext + others) |

The full ordered list is a `const` in the reader, and it is the **only**
authority — a directory not in this list is not treated as a pillar:

```ts
// core/lib/vault.ts:7
export const PILLARS = [
  "mapping", "agents", "context", "harness", "intuition", "natural-language",
  "engineering", "general", "mindset", "free-lunch", "youtube-videos",
  "build-journal",
] as const;
export type Pillar = (typeof PILLARS)[number];
```

> **If you add a 13th pillar**, you must add it here *and* create the directory.
> The reader's `walkDir` only emits notes whose top-level dir is in `PILLARS`
> (`core/lib/vault.ts:158`), so an unlisted directory's notes are silently
> dropped from every count and every pipeline.

---

## Current note counts (verified)

As of this writing, a recursive `find <pillar> -name '*.md' | wc -l` over the
live vault gives:

| Pillar | Notes |
|---|--:|
| `engineering/` | ~431 |
| `intuition/` | ~127 |
| `mapping/` | 31 |
| `harness/` | 29 |
| `natural-language/` | 22 |
| `free-lunch/` | 15 |
| `agents/` | 14 |
| `context/` | 10 |
| `general/` | 4 |
| `build-journal/` | 2 |
| `mindset/` | 1 |
| `youtube-videos/` | 1 |

Engineering and intuition dominate because they are where the daily nugget
extract finds the most signal — concrete gate/retry/handoff lessons and
ship/no-ship judgment calls. Re-run the count any time:

```bash
cd vault && for d in */; do echo "$(find "$d" -name '*.md' | wc -l)  $d"; done
```

(Counts exclude each pillar's `Map of Content.md`, which the dashboard filters
out by filename — see `dashboard/src/routes/vault/+page.server.ts:24`.)

---

## The atomic-note schema

Every `.md` file in a pillar follows the same shape. The reader is lenient (a
missing field produces a *warning*, not an error — `core/lib/vault.ts:97`), but
the canonical schema is:

1. **YAML frontmatter** delimited by `---` lines.
2. A **one-sentence summary** as the first non-heading paragraph.
3. The **body**.
4. A trailing **`## Related`** section with `[[Wikilinks]]`.

### Frontmatter fields

| Field | Type | Meaning |
|---|---|---|
| `pillar` | string | One of the 12 directory names. Must match the dir it lives in. |
| `title` | string | Human-readable; doubles as the `[[Wikilink]]` target. |
| `tier` | `1` \| `2` \| `3` | `1` = framework note (mined preferentially), `2`/`3` = supporting. |
| `content_ready` | boolean | `true` means a marketing phase can use it as-is. |
| `created` | `YYYY-MM-DD` | ISO date. js-yaml parses bare dates as `Date`; the reader coerces back to a string (`core/lib/vault.ts:57`). |
| `tags` | string[] | Free-form. `[stub, auto-generated]` marks machine-created stubs. |
| `aliases` | string[] | Alternate `[[Wikilink]]` targets; the resolver indexes these too (`core/lib/vault.ts:193`). |

The reader's interface mirrors this (`core/lib/vault.ts:23`):

```ts
export interface NoteFrontmatter {
  pillar?: string;
  title?: string;
  tier?: 1 | 2 | 3 | number;
  content_ready?: boolean;
  created?: string;
  tags?: string[];
  aliases?: string[];
  [extra: string]: unknown; // extra fields are allowed, never error
}
```

### Wikilinks

The body uses Obsidian-style links: `[[Target]]` or `[[Target|Alias]]`. The
reader extracts these with `WIKILINK_RE = /\[\[([^\]]+)\]\]/g` and strips the
`|alias` half before matching (`core/lib/vault.ts:68`). Resolution is
case- and whitespace-insensitive, against both filenames and frontmatter
`aliases` (`core/lib/vault.ts:186`). A `[[Target]]` with no matching note is an
**orphan link** — surfaced on the dashboard's `/vault/orphans` page via
`listOrphanLinks()`.

---

## A real note (full content example)

This is a real tier-1 note, complete and `content_ready`, from
`vault/mapping/Three-Stage Pipeline for Multi-Aspect Reasoning.md`:

```markdown
---
pillar: mapping
title: Three-Stage Pipeline for Multi-Aspect Reasoning
tier: 1
content_ready: true
created: '2026-05-14'
tags:
  - pipeline
  - llm
  - staging
  - architecture
aliases:
  - staged reasoning
---

Break monolithic multi-step prompts into stages: cached extraction, per-item
processing, and reasoning.

RoleNext's job-fit analysis started as one prompt doing six things at once:
parse resume, parse job description, cross-check skills, score match, explain
gaps, recommend optimizations. Results were inconsistent. The fix: three-stage
pipeline. S1 (resume extraction) runs once on upload and is cached. S2 (JD
extraction) runs per job. S3 (gap analysis) runs per job with outputs from S1
and S2. Each stage solves one problem. Scores improved from 12-45
(inconsistent) to 58-88 (consistent) for matching jobs. The key: don't try to
do your reasoning in one pass.


## Related

- [[Structured Extraction as Supplementary Hint]]
```

Note the shape: frontmatter, then a one-sentence summary line, then a single
dense paragraph, then `## Related`. The first non-heading paragraph becomes the
note's `summary` in the reader (`firstParagraph()`, `core/lib/vault.ts:80`)
unless a `title` is present, in which case the title wins.

---

## A real Map of Content

Each pillar has a `Map of Content.md` — a tier-1, `content_ready: false` index
the embed phase auto-appends links to. Real example,
`vault/mapping/Map of Content.md`:

```markdown
---
pillar: mapping
title: Mapping — Map of Content
created: 2026-05-14
tier: 1
content_ready: false
tags: [map-of-content, mapping]
aliases: []
---

# Mapping

Mental models, frameworks for thinking about systems. The 'M' in MACHINE.

## Notes

- [[Three-Stage Pipeline for Multi-Aspect Reasoning]]

- [[Lock Design Workflow After First Successful Handoff]]

- [[Search Relevance Is Communication, Not Just Calculation]]

  ... (one [[Wikilink]] per note) ...

<!-- Atomic notes in this pillar will be auto-linked here by the nuggets embed
     phase. Manual additions are fine too — just keep one note per
     [[Wikilink]] line. -->
```

The dashboard excludes any note whose filename lowercases to `map of content`
from pillar counts (`dashboard/src/routes/vault/+page.server.ts:24`), so the MOC
never inflates the numbers above.

---

## A real auto-generated stub (tier 3)

When the embed phase finalizes a review and a note references a `[[Target]]`
that doesn't exist yet, it writes a **stub** so the link isn't orphaned. Real
example, `vault/free-lunch/SSE for LLM Streaming Over Polling.md`:

```markdown
---
pillar: free-lunch
title: SSE for LLM Streaming Over Polling
tier: 3
content_ready: false
created: 2026-05-14
tags: [stub, auto-generated]
aliases: []
---

(Stub created by vault-nuggets embed because
[[Multi-Signal Intent Detection with Streaming]] referenced it. Fill in the
body.)
```

Signature of a stub: `tier: 3`, `content_ready: false`, and
`tags: [stub, auto-generated]`. These exist purely to keep the wikilink graph
connected — a marketing phase will skip them (`content_ready: false`), and
they're an obvious to-do list for the captain: open them and write the body.

---

## What's tracked in git, and what isn't

The vault is **`.gitignore`'d except for the README and this handbook**.
Notes contain personal/proprietary content (alpha-user names, internal incident
details), so they never get committed. The exact rules (`.gitignore:25`):

```gitignore
vault/*
!vault/.gitkeep
!vault/README.md
!vault/developer-handbook/
!vault/developer-handbook/**
```

So `git ls-files vault/` returns only `vault/README.md` (plus this handbook). On
a fresh clone the pillar directories and their hundreds of notes **do not
exist** — they live on the author's machine and in Obsidian. Don't expect CI or
a teammate's checkout to see them.

---

## Obsidian + the dashboard are complementary

- **Obsidian** is for browsing, editing, graph view, and backlinks. Recommended
  plugins (from the README): **Dataview** (query `tier`/`content_ready`/`pillar`
  like a database), **Templater** (fill frontmatter on manual creation), and
  **Graph Analysis** (find clusters/bridges in the wikilink network).
- **The dashboard** (`/vault`) is for the ingest workflow: extract → review →
  embed. It reads through `core/lib/vault.ts`.

Both walk the same directory, and both skip dotted dirs: `.obsidian/`
(Obsidian's config) and `.staging/` (extract candidate JSON) are ignored by the
reader's `walkDir` because it `continue`s on any `e.name.startsWith(".")`
(`core/lib/vault.ts:142`).

> **One gotcha (from the README):** the embed phase writes `.md` files
> programmatically. If you're editing the same file in Obsidian when embed runs,
> last-write-wins. Save in Obsidian *before* clicking **Embed approved**.

---

## See also

- [02-how-content-lands.md](./02-how-content-lands.md) — the full ingest path.
- [../core/09-vault-reader.md](../core/09-vault-reader.md) — the `core/lib/vault.ts` reader API.
- [../pipelines/vault-nuggets.md](../pipelines/vault-nuggets.md) — the extract/dedupe/embed pipeline.
- [../dashboard/02-routing-and-loads.md](../dashboard/02-routing-and-loads.md) — how `/vault` routes load this data.
