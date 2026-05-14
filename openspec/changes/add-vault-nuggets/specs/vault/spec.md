## ADDED Requirements

### Requirement: Vault uses the MACHINE-framework directory layout

The system SHALL provide a vault rooted at `$VAULT_ROOT` (default `command-center/vault/`) with these top-level directories: `mapping/`, `agents/`, `context/`, `harness/`, `intuition/`, `natural-language/`, `engineering/`, `general/`, `mindset/`, `free-lunch/`, `youtube-videos/`, `build-journal/`. Each directory SHALL contain a `Map of Content.md` describing the pillar and linking to its atomic notes.

#### Scenario: Vault is initialized

- **WHEN** `setup.sh` runs on a fresh install
- **THEN** all twelve pillar directories exist, each with a starter `Map of Content.md`

### Requirement: Atomic notes follow a strict frontmatter schema

Every note in the vault SHALL be a markdown file with YAML frontmatter containing: `tags` (array), `aliases` (array), `tier` (`1` | `2` | `3`), `content_ready` (boolean), `created` (ISO date), `pillar` (one of the pillar directory names). The body SHALL begin with a one-sentence summary, followed by content, followed by a `## Related` section listing `[[Wikilinks]]`.

#### Scenario: A note is parsed

- **WHEN** the vault reader parses any note
- **THEN** it returns `{ frontmatter, summary, body, related }` and reports a validation error if any required frontmatter field is missing

#### Scenario: A note is missing required frontmatter

- **WHEN** a markdown file in vault lacks the `pillar` field
- **THEN** the vault reader logs a warning and excludes that file from query results until fixed

### Requirement: Wikilink resolution is filename-based

The system SHALL resolve `[[Some Title]]` to the file `Some Title.md` in any pillar directory. Case- and whitespace-insensitive. Unresolved links SHALL be reported by the `/vault/orphans` surface (UI surface deferred; the data must be available now).

#### Scenario: A note links to an existing target

- **WHEN** note A's Related section contains `[[Deterministic Gate]]`
- **AND** a file `Deterministic Gate.md` exists in any pillar
- **THEN** the link resolves to that file

#### Scenario: A note links to a missing target

- **WHEN** the target does not exist
- **THEN** the vault reader records the link as unresolved with the source note's path and the target name

### Requirement: KB scanner reads vault and legacy sessions path

The system SHALL allow marketing-pipeline's KB scanner to read from `$VAULT_ROOT` and from `$LEGACY_SESSIONS_ROOT` (default `~/Documents/rolenext/sessions/`) in a single query. Results from both sources SHALL be unified into a single ranked output.

#### Scenario: Discovery runs after vault adoption

- **WHEN** marketing discovery's KB scanner queries for candidates
- **THEN** it walks both roots, returns atomic notes from the vault tagged by pillar and legacy session entries flagged as `source: legacy`, and ranks them together
