## Context

Marketing-pipeline's `dashboard/src/lib/` contains the right primitives (tasks, processor, claude wrapper, slop engine) but they import marketing-specific modules (`generate.ts`, `scoring.ts`, write-post prompts). The docx ride-along formalizes those primitives as a domain-neutral DAG: every pipeline is phases + gates, the differences are which phases and which gates. Five more pipelines are coming (marketing port, vault/nuggets, competitors, reddit-pmf, software-factory). They all need the same runtime. Extracting it once now is cheaper than retrofitting later.

Constraints:
- Keep the existing tech stack (SvelteKit 2.57, Svelte 5 runes, Tailwind 4, Node, file-based JSON storage). No new framework, no DB.
- Marketing-pipeline must keep running unmodified during transition — same KB path (`~/Documents/rolenext/sessions/`), same cron, different port.
- Backpressure cap is the headline behavioral change vs. marketing-pipeline today.

## Goals / Non-Goals

**Goals:**
- A `core/lib/` that knows nothing about marketing, vault, competitors, or reddit.
- Declarative pipeline registration: a domain adds a pipeline by writing a config file and a few claude-p prompts; no edits to core.
- Backpressure cap enforced in one place (processor), configurable per-pipeline with a sane default of 5.
- A `/tasks` global view that surfaces backlog state and lets the captain see when a pipeline is paused on the cap.

**Non-Goals:**
- Porting any marketing logic (phase 2).
- Designing the vault layout (phase 3).
- Multi-machine / hosted deployment.
- Replacing file-based storage with a DB.

## Decisions

**1. Single SvelteKit app, multi-domain routes.** Alternative considered: one app per domain. Rejected — sharing the task queue, processor, and KB across domains is the whole point of the Command Center. A single app with `/marketing/*`, `/software-factory/*`, `/competitors`, `/vault`, `/tasks` routes keeps state coherent.

**2. Declarative pipeline configs, not class hierarchies.** Each pipeline exports a `PipelineConfig` object: phases (id, slash command, gate type, retry policy, timeout), edges, and pipeline-level metadata (backpressure cap, cron). The processor reads this config; it does not import pipeline-specific code. Alternative: a `Pipeline` base class. Rejected — class inheritance pulls behavior into core, defeating the abstraction.

**3. Gate types are first-class.** `GateType = 'needs_review' | 'deterministic' | 'auto_pass'`. A `deterministic` gate carries a `check: (task) => Promise<{pass: boolean, reason?: string}>` function defined inside the pipeline. Core invokes it; core does not know what it checks. This is how slopgate plugs in.

**4. Backpressure cap in the processor, not the scheduler.** When cron POSTs to `/api/cron` the processor first asks: "for any pipeline whose first phase this task would start, is the needs_review queue already at the cap?" If yes, the task is deferred (not dropped). This means a cron miss does not lose work — the next tick will retry once the captain clears review. Alternative: check at cron time. Rejected — cron is dumb on purpose; the processor is where logic lives.

**5. File-based task store, JSON files keyed by id.** Same as marketing-pipeline today. Alternative: SQLite. Rejected for phase 1 — file-based works, is grep-able, and a DB is reversible later if performance bites.

**6. Port 3001 during transition.** Marketing-pipeline keeps 3000. After phase 2 lands and marketing-pipeline is archived, command-center can move to 3000 if desired.

## Risks / Trade-offs

- [Risk] Core abstraction is wrong and phase 2 fights it → Mitigation: phase 2 is the validator. If marketing port requires core changes, that's expected and fine; the cost of getting it wrong is one refactor cycle, not a stuck migration.
- [Risk] File-based task store hits a concurrency bug under the new processor → Mitigation: keep marketing-pipeline's existing locking approach; if it's already broken there, fix it here and back-port if needed.
- [Risk] Backpressure cap surprises the captain (silent pause) → Mitigation: `/tasks` route shows cap status prominently; a paused pipeline is visible, not hidden.

## Migration Plan

1. Build core in command-center on port 3001. Marketing-pipeline keeps running.
2. Verify with a trivial test pipeline (one phase, auto-pass gate) that the processor + queue + cap behave correctly end-to-end.
3. Hand off to phase 2 (port-marketing-pipeline) for real validation.

Rollback: command-center is greenfield; if scrapped we simply stop the cron and rm the repo. Marketing-pipeline is untouched.

## Open Questions

- Should the slop engine live in `core/lib/slop.ts` or in `pipelines/marketing/`? Leaning core, because vault-nuggets and reddit-pmf may want it too. Rules stay pluggable per pipeline.
- Should the claude CLI wrapper enforce a global concurrency limit (only N claude -p processes at once)? Not in phase 1; revisit when load demands.
