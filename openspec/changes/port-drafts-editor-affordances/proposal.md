## Why

Phase 2's spec required four interactive controls on the per-platform drafts editor: refine (claude-powered rewrite), per-platform regenerate, slop re-check, and per-platform status changes. My port shipped `/marketing/drafts/[slug]` as a read-only tabbed viewer. The audit flagged this as P1 (workflow-critical but not blocking automation).

Marketing-pipeline's drafts editor is the captain's actual daily-work surface. Without these affordances, the captain has to drop into a terminal to mutate drafts — defeating the dashboard's purpose.

## What Changes

- `POST /api/marketing/drafts/<date>/refine` — accepts `{ platform: string, instruction: string }`. Loads the platform's `<date>/<platform>.md`, sends it + the instruction to claude with a refinement prompt, writes the result back, re-runs slop check, returns the new content + slop result.
- `POST /api/marketing/drafts/<date>/regenerate/<platform>` — accepts optional `{ angle?: string, hook?: string }`. Re-invokes the same per-platform generate logic from `pipelines/marketing/lib/generate.ts` for one platform, writes a fresh `<platform>.md`, returns updated content.
- `POST /api/marketing/drafts/<date>/slop-check` — accepts `{ platform?: string }`. Runs the slop engine over one or all platforms, returns violations.
- `POST /api/marketing/drafts/<date>/status` — accepts `{ platform: string, status: "draft" | "slop-checked" | "reviewed" | "posted" }`. Updates the per-platform entry in `status.json`.
- UI: `/marketing/drafts/<slug>` per-platform tab gains four controls — Refine (text input + button), Regenerate, Slop-check, Status dropdown. Each shows inline result/error/loading state.
- The shared refinement prompt lives in `pipelines/marketing/cli/refine-post.md` (new file). It carries the same voice guardrails as `write-post-shared.md`.

## Capabilities

### New Capabilities
<!-- none — all under drafts-editor -->

### Modified Capabilities
- `drafts-editor`: Refine, regenerate, slop-check, and per-platform status update are surfaced in the per-platform editor

## Impact

- New API endpoints under `dashboard/src/routes/api/marketing/drafts/[date]/...`.
- New SvelteKit component or extension to `/marketing/drafts/[slug]` for the controls.
- New prompt file `pipelines/marketing/cli/refine-post.md`.
- No changes to core. No changes to task store.
- These actions mutate drafts on disk — they're orthogonal to the task queue (the captain edits between generate and review without going through the pipeline). Per-platform `status.json` updates are visible immediately.
