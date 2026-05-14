## Context

Two things are true at once: (1) the captain has a real corpus already — session exports at `~/Documents/rolenext/sessions/`, git commit messages, alpha-user DMs, dogfooding logs; (2) none of it is organized for retrieval. The MACHINE framework (Mapping, Agents, Context, Harness, Intuition, Natural-Language, Engineering) plus four utility pillars (General, Mindset, Free-Lunch, YouTube-Videos) is the docx's organization scheme. The nuggets pipeline is the docx's recommended writeback mechanism: extract candidates, captain approves, system embeds. Phase 3 builds the vault layout and the writeback pipeline; it does not try to mine the entire corpus in one shot — that's an ongoing cron.

## Goals / Non-Goals

**Goals:**
- A vault layout that's grep-able, wikilink-aware, and readable by marketing's KB scanner with zero rewriting of that scanner.
- A nuggets pipeline that respects the cap (≤5 needs_review extractions waiting at any time).
- Dedup against existing vault before staging a new nugget — never ask the captain to approve a duplicate.
- Zero loss of legacy session exports: they remain at the source path until lifted into vault by the captain's approval.

**Non-Goals:**
- Embeddings / vector search. Atomic notes + tags + wikilinks are enough for claude -p style retrieval.
- Auto-publishing nuggets without captain review (everything routes through one human gate, by design).
- Migrating the build-journal in this phase beyond the directory existing — populating it is ongoing captain work.

## Decisions

**1. Atomic notes are Obsidian-compatible markdown.** The docx names Obsidian explicitly. The vault directory is structured so the captain can open it as an Obsidian vault if desired, but command-center reads it as plain files (no Obsidian dependency). Wikilinks `[[Name]]` are resolved by filename match.

**2. Pillar = top-level directory.** No `pillar` field is strictly required in frontmatter (the directory provides it), but we keep it as a frontmatter field anyway because it makes search results self-describing without a parent path. Alternative: omit. Rejected — small cost, big readability win.

**3. Tier and content_ready are first-class.** Per the docx, tier-1 framework notes are mined preferentially. `content_ready: true` means a marketing phase can use it as-is; `false` means it needs work first. Both are filterable from the dashboard.

**4. Nuggets pipeline is two phases: extract + embed.** Extract runs claude -p over new sources, emits candidate nuggets with proposed pillar + tags + Related links, dedup against the live vault, stage in `vault/.staging/`. Review needs_review gate. Embed phase writes approved nuggets into the target pillar directory, generates the wikilink stubs (creating empty Map of Content placeholders if missing). Alternative: collapse into one phase. Rejected — separating extract from embed lets the captain edit a candidate before it lands without re-running extract.

**5. Dedup uses filename + summary similarity, not full-text.** Cheap, fast, surprisingly accurate for atomic notes. Threshold tunable; default Jaccard 0.55 on summary tokens.

**6. Legacy sessions path remains readable.** `VAULT_ROOT` defaults to `command-center/vault/`, but the KB scanner walks both `VAULT_ROOT` and `LEGACY_SESSIONS_ROOT` (`~/Documents/rolenext/sessions/`) and treats both as readable sources. Writeback only ever targets `VAULT_ROOT`.

## Risks / Trade-offs

- [Risk] Captain doesn't keep up with nugget review; the staging dir grows unbounded → Mitigation: the same backpressure cap applies (≤5 needs_review extractions). When capped, extract stops creating new tasks until review catches up. The docx's whole point.
- [Risk] Wikilink rot when a Related target is renamed → Mitigation: phase-3 scope is creation, not maintenance. Add a `/vault/orphans` view in a later iteration if it bites.
- [Risk] Embeddings would be better than tags for retrieval → Acknowledged. Defer until claude -p prompts start failing on tag-based retrieval. Today they don't.

## Migration Plan

1. Create the directory structure and a starter set of Map of Content stubs (one per pillar).
2. Build extract + embed phases against an empty vault.
3. Run extract over the existing `~/Documents/rolenext/sessions/` corpus once; captain reviews and approves to populate the vault initially.
4. Add the 9 AM cron entry for ongoing extraction.

Rollback: vault is a directory; `rm -r vault/` reverts. Legacy sessions path is untouched.

## Open Questions

- Should `cli/log-journal.sh` write directly to `vault/build-journal/` as a build-journal note, or stage it for nugget extraction like sessions? Recommend direct — build-journal entries are first-person captain content and should land directly; the nugget pipeline can still mine them for atomic notes later.
- Should the embed phase auto-create Map of Content files when a wikilink references a missing target? Yes — empty stub with `content_ready: false`, captain fills in later.
