## Why

Phase 1 ships a domain-agnostic core but proves nothing about the abstraction until a real pipeline runs on it. Marketing-pipeline is the natural validator: it has a fully working DAG (discovery → generate → slop-check → review), real cron schedules, six platform writers, and a drafts editor the captain uses daily. Porting it forces the core API to be correct and gives the Command Center its first revenue-relevant pipeline. Once this lands, the marketing-pipeline repo can be archived.

## What Changes

- Add `pipelines/marketing/` to command-center containing the discovery, generate, slop-check, and review phases as core-registered `PipelineConfig` declarations.
- Port the existing claude-p prompts (`kb-scanner.md`, `write-post-shared.md`, `write-post-{platform}.md`) into `pipelines/marketing/cli/`.
- Port platform constants (linkedin, x, instagram, facebook, reddit, blog) and scoring weights into `pipelines/marketing/lib/`.
- Add `/marketing` routes to the dashboard: discovery dashboard, KB browser, drafts list, per-platform draft editor with claude refinement.
- Wire marketing-specific cron entries (10 AM signals, 11 AM discovery) pointing at command-center on port 3001.
- Register slop rules (`slop-rules/*.yaml`) with the core slop engine; the slop gate becomes a `deterministic` gate that returns `{pass: violations.length === 0}` and retries up to 3 times.
- Mark the marketing-pipeline repo at `/home/adrian/Developer/projects/marketing-pipeline/` as archived (no code changes; just a deprecation note in its README).

## Capabilities

### New Capabilities
- `marketing-pipeline`: end-to-end content DAG with discovery, generation, slop-check, and review phases
- `slop-rules`: regex rule packs that detect AI writing patterns and gate generation output
- `drafts-editor`: per-platform draft surface with claude-powered refinement and regeneration

### Modified Capabilities
<!-- none; phase 1 capabilities are extended in pipeline configs, not their spec text -->

## Impact

- Marketing-pipeline at `/home/adrian/Developer/projects/marketing-pipeline/` is archived after parity is verified. No source files are mutated; only a deprecation note added.
- KB source path remains `~/Documents/rolenext/sessions/` (env var `VAULT_ROOT`).
- Marketing cron entries move from marketing-pipeline's crontab section to command-center's (port 3000 → 3001).
- Drafts directory moves from `marketing-pipeline/drafts/` to `command-center/drafts/`. Existing drafts are copied, not symlinked.
- The session-end Claude Code hook keeps writing to `~/Documents/rolenext/sessions/`; no hook changes required.
