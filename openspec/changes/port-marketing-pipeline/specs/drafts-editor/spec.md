## ADDED Requirements

### Requirement: Per-platform draft editor surface

The system SHALL expose `/marketing/drafts` listing every draft directory with status, platform, and created timestamp. Selecting a draft SHALL open a per-platform editor that displays the markdown, a slop-check panel, and controls for: claude-powered refinement, full regeneration, slop re-check, and per-platform status changes.

#### Scenario: Captain opens a draft

- **WHEN** the captain clicks a draft in the drafts list
- **THEN** the editor shows the markdown for the selected platform, current slop violations (if any), and the refinement/regenerate/status controls

#### Scenario: Captain runs claude refinement

- **WHEN** the captain enters a refinement instruction and clicks "Refine"
- **THEN** a claude -p invocation rewrites the draft with that instruction, a fresh slop check runs, and the editor reloads with the updated draft

#### Scenario: Captain regenerates one platform

- **WHEN** the captain clicks "Regenerate" on a single platform draft
- **THEN** only that platform's subagent is re-invoked; other platform drafts are unchanged

### Requirement: Approval propagates to KB

The system SHALL mark source KB entries `usedForContent: true` only when the captain approves a draft set via the review bin. Approving a single platform draft in isolation SHALL NOT modify KB.

#### Scenario: Captain approves a draft set in the review bin

- **WHEN** approval is granted in the review bin
- **THEN** every KB entry referenced by that task's candidate has its frontmatter `usedForContent` set to `true`
