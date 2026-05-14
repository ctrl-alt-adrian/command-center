## Why

The Command Center claims to be the hub for marketing **and** software factory **and** future use cases. Phases 1–5 prove the abstraction for marketing-adjacent work, but the multi-domain pattern is vaporware until a second non-marketing domain ships. The software-factory directory already exists empty at `~/Developer/projects/software-factory/`. Phase 6 brings it inside command-center as a registered domain with its own routes, its own pipeline configs folder, and one trivial pipeline that exercises the full machinery end-to-end. Future software-factory work (e.g. an autonomous "spec → branch → PR" pipeline, a flaky-test triage loop, a dependency-update flow) plugs in here.

## What Changes

- Add `pipelines/software-factory/` directory and `/software-factory` dashboard route.
- Register one minimal pipeline `daily-housekeeping` to validate the multi-domain pattern: a single `auto_pass` phase that scans command-center's repo for orphan tasks (tasks > 7 days old in `paused_backpressure`) and clears them with a logged reason. Demonstrates a pipeline that takes action against the system itself, which is the canonical software-factory shape.
- Reserve the namespace for future software-factory pipelines (spec-to-PR, test-triage, dep-bump) without implementing them.
- Add a software-factory-flavored README so when the captain (or a future agent) opens this folder, the pattern for adding pipelines is obvious.
- Migrate the empty `~/Developer/projects/software-factory/` directory by either: (a) symlinking it to `command-center/pipelines/software-factory/`, or (b) leaving it alone and treating it as superseded.

## Capabilities

### New Capabilities
- `software-factory-domain`: software-factory namespace within command-center with one validating pipeline (daily-housekeeping)

### Modified Capabilities
<!-- none -->

## Impact

- No new external dependencies.
- One new cron entry: daily 3 AM (off-peak so it doesn't compete with marketing's 10/11 AM jobs).
- `~/Developer/projects/software-factory/` decision is captured as an open question; recommendation is to fold it into command-center.
- The pattern this phase locks in is what future software-factory work follows; choices made here propagate to every later pipeline in the domain.
