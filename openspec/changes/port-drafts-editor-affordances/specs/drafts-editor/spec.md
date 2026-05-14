## MODIFIED Requirements

### Requirement: Per-platform draft editor surface

The system SHALL expose `/marketing/drafts` listing every draft directory with status, platform, and created timestamp. Selecting a draft SHALL open a per-platform editor that displays the markdown, a slop-check panel, and controls for: claude-powered refinement (Refine button with instruction text input), full regeneration of one platform (Regenerate button), explicit slop re-check (Slop-check button), and per-platform status changes (status dropdown).

#### Scenario: Captain opens a draft

- **WHEN** the captain clicks a draft in the drafts list
- **THEN** the editor shows the markdown for the selected platform, current slop violations (if any), and the four controls (Refine, Regenerate, Slop-check, Status)

#### Scenario: Captain runs claude refinement

- **WHEN** the captain enters a refinement instruction "make the opening punchier" and clicks Refine
- **THEN** `POST /api/marketing/drafts/<date>/refine` invokes claude with the current content + instruction + shared voice rules
- **AND** the updated draft is written to `drafts/<date>/<platform>.md`
- **AND** a fresh slop check runs over the new content
- **AND** the editor re-renders with the new content + new slop result without a page reload

#### Scenario: Captain regenerates one platform

- **WHEN** the captain clicks Regenerate on a single platform draft
- **THEN** `POST /api/marketing/drafts/<date>/regenerate/<platform>` re-invokes the per-platform generation logic for that one platform
- **AND** only that platform's `<platform>.md` is rewritten; other platform drafts in the same `drafts/<date>/` are unchanged

#### Scenario: Captain explicitly re-runs slop

- **WHEN** the captain clicks Slop-check
- **THEN** `POST /api/marketing/drafts/<date>/slop-check` returns the current platform's violations without modifying the draft
- **AND** the slop panel updates inline

#### Scenario: Captain changes per-platform status

- **WHEN** the captain selects "posted" from the status dropdown for the linkedin draft
- **THEN** `POST /api/marketing/drafts/<date>/status` updates `drafts/<date>/status.json` with `linkedin: "posted"`
- **AND** the status badge in the tab updates immediately

### Requirement: Approval propagates to KB

The system SHALL mark source KB entries `usedForContent: true` only when the captain approves a draft set via the review bin. Approving a single platform draft in isolation (via the status dropdown) SHALL NOT modify KB.

#### Scenario: Captain approves a draft set in the review bin

- **WHEN** approval is granted in the review bin
- **THEN** every KB entry referenced by that task's candidate has its frontmatter `usedForContent` set to `true`

#### Scenario: Captain marks a single draft "posted" via the editor

- **WHEN** the captain sets the linkedin draft's status to "posted" via the editor dropdown
- **THEN** `status.json` updates but KB markdown files are NOT touched

## ADDED Requirements

### Requirement: Shared refinement prompt with voice guardrails

The system SHALL include a refinement prompt file `pipelines/marketing/cli/refine-post.md` that incorporates the same voice rules as `write-post-shared.md` (banned words, banned patterns, no-em-dash, no-engagement-bait), framed as "your job is to apply the user's instruction to the existing draft while keeping the voice rules." The refine endpoint SHALL load this prompt for every refinement call.

#### Scenario: Refine respects voice guardrails

- **WHEN** the captain refines a draft with the instruction "make it more exciting"
- **THEN** the refinement prompt instructs claude to apply the instruction WHILE keeping the banned-word and banned-pattern rules
- **AND** the post-refine slop check confirms zero violations (or surfaces them for captain decision)
