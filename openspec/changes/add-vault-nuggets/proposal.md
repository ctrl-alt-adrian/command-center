## Why

The docx is blunt: "A pipeline reading from a thin vault writes thin posts." Marketing-pipeline today reads session exports as flat markdown — fine for raw recall, useless for RAG-style grounding. The Command Center needs the MACHINE-framework atomic-note vault the docx describes: one concept per file, tagged frontmatter, wikilinks, organized by capability. Without it, every downstream marketing/competitors/reddit phase produces generic output. The cheapest way to grow the vault is the nuggets pipeline: scan session exports and build-journal entries, surface candidate atomic notes, captain approves, system embeds. Curation never becomes a second job.

## What Changes

- Establish a vault directory at `command-center/vault/` with MACHINE-framework subdirectories: `mapping/`, `agents/`, `context/`, `harness/`, `intuition/`, `natural-language/`, `engineering/`, plus `general/`, `mindset/`, `free-lunch/`, `youtube-videos/`, and `build-journal/`.
- Define the atomic-note schema: YAML frontmatter (`tags`, `aliases`, `tier`, `content_ready`, `created`, `pillar`), one-sentence summary, body, `## Related` section with `[[wikilinks]]` to its Map of Content.
- Add a `pipelines/vault-nuggets/` pipeline: extract-nuggets phase (scans new session exports and build-journal entries, dedupes against existing vault), needs_review gate, embed-nuggets phase (writes approved nuggets into the right MACHINE directory with wikilinks).
- Generalize core's `vault.ts` reader to walk the new directory structure and emit query results compatible with marketing-pipeline's KB scanner.
- Add `/vault` dashboard surface: browse by pillar, view atomic notes, inspect pending nuggets, approve/reject.
- Migrate existing `~/Documents/rolenext/sessions/` content as `build-journal/` entries (no schema change, just relocate).

## Capabilities

### New Capabilities
- `vault`: MACHINE-framework atomic-note knowledge base with frontmatter schema and wikilink graph
- `nuggets-pipeline`: two-phase extract → review → embed flow that grows the vault from sessions and journals

### Modified Capabilities
- `marketing-pipeline`: discovery's KB scanner now reads the MACHINE vault instead of (or in addition to) the flat sessions path

## Impact

- New env var: `VAULT_ROOT` defaults to `command-center/vault/`. Legacy path `~/Documents/rolenext/sessions/` remains readable for backward compatibility during transition.
- Session-end Claude Code hook continues to write raw session exports to `~/Documents/rolenext/sessions/`; the nuggets pipeline lifts them into the vault on a daily cron.
- Build-journal entries (commit messages, alpha-user notes, dogfooding logs) flow in via a new manual command `cli/log-journal.sh`.
- One new cron entry: daily 9 AM nuggets-extract.
