## ADDED Requirements

### Requirement: Nuggets pipeline registers a two-phase DAG

The system SHALL register a `vault-nuggets` pipeline with phases `extract` (gate `needs_review`) and `embed` (gate `auto_pass`). Top-of-pipeline tasks SHALL be created by a daily 9 AM cron entry. Backpressure cap SHALL default to 5.

#### Scenario: Daily extract fires

- **WHEN** the 9 AM cron POSTs a top-of-pipeline task to vault-nuggets
- **THEN** an extract task runs, scans new sources, dedupes against the live vault, stages candidates in `vault/.staging/<task-id>/`, and lands in `needs_review`

#### Scenario: Backpressure pauses extract

- **WHEN** 5 extract tasks already sit in `needs_review`
- **THEN** the next cron tick creates the new task in `paused_backpressure` instead of dispatching it

### Requirement: Extract phase scans new sources and dedupes

The extract phase SHALL scan: (a) session exports under `$LEGACY_SESSIONS_ROOT` modified since the last successful extract, and (b) files under `vault/build-journal/` modified since the last successful extract. It SHALL emit candidate atomic notes with proposed `pillar`, `tags`, `aliases`, `summary`, `body`, and `[[Related]]` links. Before staging, it SHALL run dedup (Jaccard ≥ 0.55 on summary tokens) against the live vault and drop any candidate that matches an existing note.

#### Scenario: New session export contains a shareworthy nugget

- **WHEN** a session export from yesterday contains a passage matching a "pain point" or "aha moment" pattern
- **THEN** extract proposes one atomic note for it under the appropriate pillar with summary, body, and Related links

#### Scenario: Candidate duplicates existing vault note

- **WHEN** extract proposes a candidate whose summary tokens overlap an existing note above the threshold
- **THEN** the candidate is dropped before staging and recorded in the task's `dropped.json` for the captain's visibility

### Requirement: Embed phase writes approved nuggets and creates wikilink stubs

The embed phase SHALL move every approved candidate from `vault/.staging/<task-id>/` to its target pillar directory, preserving frontmatter and body. If a `[[Wikilink]]` references a missing target, the embed phase SHALL create an empty stub note at the target with `content_ready: false` and add it to the pillar's `Map of Content.md`.

#### Scenario: Captain approves three candidates

- **WHEN** the captain approves 3 of 5 candidates in the staging review
- **THEN** the embed phase writes 3 files to their target pillars, creates any missing wikilink stubs, updates the pillar Map of Content, and the task transitions to `completed`

#### Scenario: Captain rejects a candidate

- **WHEN** the captain rejects a candidate with a note
- **THEN** that file is removed from staging, the rejection note is recorded, and the candidate's source is marked so a future extract does not re-propose it within 30 days

### Requirement: /vault dashboard surface

The system SHALL expose `/vault` showing: pillar tree, per-pillar note count, recent notes, pending extract tasks awaiting review, and a per-task staging review UI with approve/reject controls.

#### Scenario: Captain reviews a pending extraction

- **WHEN** the captain opens a needs_review extract task at `/vault`
- **THEN** the staging review UI shows each candidate's proposed pillar, frontmatter, body, and Related links, with per-candidate approve/reject controls
