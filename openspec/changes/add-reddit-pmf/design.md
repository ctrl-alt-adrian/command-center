## Context

This pipeline runs as a deliberate counterpoint to the gated marketing pipeline. The docx is explicit: "Reddit gives you views without an audience, which is why the gates can come out. The cost of shipping a bad landing page is roughly zero, and the signal (clicks, signups, engagement) does the gating that humans would otherwise do." The captain is pre-audience and post-build, which is the exact scenario where this beats LinkedIn build-in-public on time-to-signal. Phase 5 is the first pipeline in command-center where all three phases run gate-`auto_pass` — the market is the gate, not the captain.

That said, "zero gates" requires teeth in the upstream phases: the extract phase must produce hypotheses good enough that auto-deploy is sane. We achieve this by being deliberate about: scrape volume (top 50 per sub, not everything), clustering rigor (claude -p with a structured output schema), and slop-rule strictness for Reddit voice (no AI tells, no "delve", no em-dashes — the docx mentions slopgate as the canonical deterministic gate, but the docx ALSO removes gates here; we resolve this by making the slop gate fire INSIDE the extract phase as a self-check rather than at a pipeline gate, so a slop failure simply causes claude -p to retry within the same phase, not a queue-level retry loop).

## Goals / Non-Goals

**Goals:**
- Five landing-page URLs per week, each pointing at a different RoleNext positioning.
- Per-hypothesis metrics visible at `/reddit-pmf` so the captain can spot winners without spinning up an agent.
- A slop-checked, Reddit-native voice in extract phase output. AI tells kill the experiment.
- The whole pipeline runs end-to-end in under 15 minutes (5 subs × scrape + cluster + 5 deploys).

**Non-Goals:**
- Auto-posting Reddit comments. The captain drops links manually — that's a feature, not a bug; Reddit auto-promotion is a fast path to a ban.
- Reading post comments (only post titles + bodies for the first iteration). Comments add signal but multiply token cost; defer.
- A/B testing within a hypothesis (each hypothesis is a single positioning; A/B is a later layer).
- Auto-promoting a "winner" anywhere downstream. Winner promotion is a captain decision.

## Decisions

**1. Three phases, all `auto_pass`.** Scrape, extract, deploy. The market gates downstream of the pipeline (CTR + signup measured by the metrics sweep). Alternative: a needs_review between extract and deploy. Rejected — defeats the docx's whole point.

**2. Slop check is intra-phase, not gate-level.** Extract calls claude -p, runs slop against the output, if violations exist retries the prompt with feedback (max 3 retries), then commits. From the processor's view, the phase either succeeded or failed; there's no pipeline-level retry loop. Keeps the "zero gates" guarantee while still enforcing voice quality.

**3. Vercel branch deploys via the Vercel REST API.** The landing-page repo is separate. Deploy phase pushes a new branch with the generated content files, then triggers a deploy. Alternative: monorepo with command-center. Rejected — bloats the build pipeline of every other domain.

**4. Cluster shape is fixed at 5 ± 2.** Claude is prompted to produce 5 clusters, accept 3–7. Fewer than 3 → phase fails, captain alerted; more than 7 → trim by cluster size. Predictable batch size makes the metrics dashboard sane.

**5. Metrics sweep is its own phase, separate pipeline.** Pipeline `reddit-pmf-metrics`, single phase, weekly Friday 5 PM. Reads Vercel Analytics for each deployed URL from the last 6 weeks, computes CTR + signup-rate, writes to `signals/reddit-pmf/metrics.json`. Alternative: bake into deploy. Rejected — deploy runs Monday, metrics need a full week of data.

**6. Hypotheses persist across weeks.** `signals/reddit-pmf/hypotheses.json` is the canonical store — append on deploy, never delete, status field tracks `live | archived | winner`. The captain can run the metrics sweep and the winner-decision flow against this single store.

## Risks / Trade-offs

- [Risk] Reddit API rate limits → Mitigation: 60 req/min on OAuth; we need ~25 requests/week; comfortable margin.
- [Risk] Vercel free-tier limits on branch deploys → Acknowledged. Free tier supports unlimited deploys but caps bandwidth + Edge function invocations. For 5 landing pages × ~100 clicks each per week, we are far under any cap.
- [Risk] Auto-deployed landing pages look bad → Mitigation: the landing-template at `pipelines/reddit-pmf/landing-template/` is a curated, designed Svelte/Next.js shell. Only headline, subhead, hero copy, and CTA text are claude-generated. Visual quality is fixed.
- [Risk] Captain forgets to drop the Reddit comments → Mitigation: `/reddit-pmf` highlights "links awaiting placement" prominently for the first week after deploy.

## Migration Plan

1. Scaffold the landing-template repo (separate concern, can pre-stage).
2. Build scrape + extract phases first; deploy phase last.
3. Smoke-test with 1 subreddit, 1 cluster, 1 deploy.
4. Scale to 5 subreddits the following Monday.

Rollback: archive all deployed branches (a Vercel API call); delete `pipelines/reddit-pmf/`; remove crons.

## Open Questions

- Subreddit selection: docx lists `r/cscareerquestions`, `r/EngineeringResumes`, `r/recruitinghell`, `r/csMajors`, `r/jobs` (or `r/layoffs`). Confirm with captain before lock-in; might swap `r/jobs` for `r/layoffs` based on positioning.
- Should the metrics sweep also pull from Reddit comment engagement on the captain's link drops? Useful, but adds OAuth scope. Defer to a later iteration.
- Where do landing-page winners go — fold into main RoleNext landing, or stay live as alt-positioning entry points? Captain decision; out of scope for this proposal.
