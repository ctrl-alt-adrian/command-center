# How Content Lands in the Vault

Notes reach the vault by exactly two paths: the **automated nuggets pipeline**
(the daily one), and a **manual CLI write** to the build journal. This page
traces both, plus the dashboard routes you use to review and approve, and why
the marketing/personal-brand pipelines read from `$VAULT_ROOT` at all.

For the note *format* and the pillar layout, see
[01-machine-framework.md](./01-machine-framework.md).

---

## Path 1: the vault-nuggets pipeline (the daily one)

The `vault-nuggets` pipeline runs on a cron schedule and turns raw work logs
into reviewed atomic notes. The stages, end to end:

```
sessions + build-journal  →  extract (Haiku)  →  dedupe  →  stage  →  REVIEW  →  embed
   (raw material)            candidate notes     vs vault   .staging/   (captain)   pillar dir
```

1. **Scan sources.** The extract phase reads two roots:
   `~/Documents/rolenext/sessions/` (raw RoleNext work-session logs) and
   `vault/build-journal/` (manual journal entries). These are *raw material*,
   not content — they're mined, never published directly. (Source roots live in
   `pipelines/vault-nuggets/lib/sources.ts` and `core/lib/paths.ts`.)

2. **Extract candidate notes.** A `claude -p` call (Haiku for cheap bulk
   extraction) drafts candidate atomic notes from each source, already shaped
   into the frontmatter schema — pillar, title, tier, summary, body.

3. **Dedupe against the live vault.** Before anything is staged, candidates are
   compared against existing notes so the same lesson isn't re-mined every day
   (`pipelines/vault-nuggets/lib/dedup.ts`). This is *also* why raw sessions
   were cut as a direct marketing source: keeping both the raw session and the
   refined note as content sources risked duplicate-content. The vault is now
   the single refined layer.

4. **Stage for review.** Survivors are written to
   `vault/.staging/<taskId>/` as candidate JSON. The `.staging` directory is
   dot-prefixed, so both the vault reader's `walkDir` and Obsidian's indexer
   skip it — staged candidates never pollute the live note index
   (`core/lib/vault.ts:142`). The task transitions to `needs_review`.

5. **Captain approves in `/vault`.** You open the dashboard, review each
   candidate, approve or reject. (No confirm dialog — clicking the button *is*
   the confirmation.)

6. **Embed.** On finalize, the embed phase
   (`pipelines/vault-nuggets/lib/embed.ts`):
   - writes each **approved** note as a real `.md` file into its target pillar
     directory,
   - creates a **wikilink stub** for any `[[Target]]` referenced but missing
     (tier 3, `content_ready: false`, `tags: [stub, auto-generated]` — see the
     stub example in [01-machine-framework.md](./01-machine-framework.md)),
   - **appends** the new note's `[[Wikilink]]` to that pillar's
     `Map of Content.md`.

After embed, the cached note list is busted (`bustNotesCache()`,
`core/lib/vault.ts:163`) so the dashboard immediately reflects the new notes.

> See [../pipelines/vault-nuggets.md](../pipelines/vault-nuggets.md) for the
> phase-by-phase config (gate types, retry, cron schedule).

---

## The `/vault` dashboard routes

All `/vault` pages are SvelteKit routes whose `+page.server.ts` `load()`
functions read the vault through `core/lib/vault.ts`. They're read-only views
plus approve/reject actions; the heavy lifting stays server-side.

| Route | File | What it shows |
|---|---|---|
| `/vault` | `vault/+page.server.ts` | Per-pillar counts + 3 most-recent notes, orphan count, pending-review tasks with staged candidate counts, running-extract banner. |
| `/vault/[pillar]` | `vault/[pillar]/+page.server.ts` | All notes in one pillar. |
| `/vault/[pillar]/[note]` | `vault/[pillar]/[note]/+page.server.ts` | A single note: rendered body, frontmatter, resolved `## Related` links. |
| `/vault/orphans` | `vault/orphans/+page.server.ts` | `[[Wikilinks]]` that resolve to nothing (`listOrphanLinks()`). |
| `/vault/staging/[task]` | `vault/staging/[task]/+page.server.ts` | The review screen: staged candidates for one extract task, approve/reject before embed. |

The overview `load()` is a good map of the whole data flow — it composes the
reader, the task store, and the staging lister in parallel
(`dashboard/src/routes/vault/+page.server.ts:7`):

```ts
const [notes, tasks] = await Promise.all([
  listNotes().catch(() => []),
  listTasksByPipeline("vault-nuggets"),
]);
const orphans = await listOrphanLinks(notes).catch(() => []);
// ...per-pillar counts, recent-3 per pillar, pending-review staged details
```

Note the `.catch(() => [])` guards: on a fresh clone the pillar dirs may not
exist (the vault is gitignored), so the reader fails soft to an empty list
rather than 500-ing the page. For the routing model in general, see
[../dashboard/02-routing-and-loads.md](../dashboard/02-routing-and-loads.md).

---

## Path 2: the manual CLI write (`cli/log-journal.sh`)

You don't have to go through nugget review to capture something. `cli/log-journal.sh`
writes a `.md` **directly** into `vault/build-journal/`:

```bash
# one-line entry
cli/log-journal.sh rolenext "Stripe live mode finally working after the webhook race fix"

# multi-line entry from stdin
cli/log-journal.sh rolenext --body < /tmp/dogfood-notes.md
```

It honors `$VAULT_ROOT` (falling back to `$ROOT/vault`) and writes a tier-2,
`content_ready: false` note (`cli/log-journal.sh:50`):

```bash
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
```

This entry is **raw material**, not finished content. It lands in
`build-journal/`, which is one of the two roots the nuggets extract phase scans
— so a journal entry you write today can be mined into refined atomic notes
later. The captain can also just edit the file directly in Obsidian.

---

## Why marketing & personal-brand read from `$VAULT_ROOT`

This is the whole point of the vault's existence. The README's framing:

> "A pipeline reading from a thin vault writes thin posts."

The marketing and personal-brand pipelines do their discovery, generation, and
refinement **exclusively from `$VAULT_ROOT`** — refined, deduped, `content_ready`
atomic notes. They no longer read raw RoleNext sessions directly. The reasons:

- **No duplicate content.** If a phase could pull from both the raw session
  *and* the note extracted from it, the same lesson could ship twice. Cutting
  raw sessions as a direct source removes that risk (the dedupe step in §1
  enforces it at extract time too).
- **Quality floor.** Everything in the vault has passed extract → dedupe →
  human review. Posts are built on vetted material, so a thin vault is *visibly*
  thin and a rich vault produces rich posts.

The personal-brand pipeline in particular generates per-platform drafts from
vault notes; you then refine them in the drafts editor. See
[../pipelines/personal-brand.md](../pipelines/personal-brand.md) and the editor
walkthrough in
[../dashboard/05-components-and-patterns.md](../dashboard/05-components-and-patterns.md).

---

## Summary of the two paths

| | Automated (nuggets) | Manual (`log-journal.sh`) |
|---|---|---|
| Entry point | cron → extract phase | shell command |
| Goes through review? | Yes (`/vault/staging/[task]`) | No |
| Lands as | reviewed note in target pillar | tier-2 `build-journal/` entry |
| Becomes content? | directly usable when `content_ready: true` | raw material; mined later |
| Creates stubs / updates MOC? | Yes (embed phase) | No |

---

## See also

- [01-machine-framework.md](./01-machine-framework.md) — note format & pillars.
- [../pipelines/vault-nuggets.md](../pipelines/vault-nuggets.md) — extract/dedupe/embed pipeline.
- [../pipelines/personal-brand.md](../pipelines/personal-brand.md) — a consumer of the vault.
- [../core/09-vault-reader.md](../core/09-vault-reader.md) — `core/lib/vault.ts` API.
- [../dashboard/02-routing-and-loads.md](../dashboard/02-routing-and-loads.md) — `/vault` route loads.
