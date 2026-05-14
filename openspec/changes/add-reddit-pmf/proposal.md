## Why

The docx calls this "the highest-leverage move right now" for a pre-audience, post-build builder. Reddit gives views without an audience, so the gates that elsewhere protect taste and voice come out — the subreddit IS the audience, the cost of shipping a bad landing page is zero, and click/signup signal does the gating that humans would otherwise do. Five subreddits (`r/cscareerquestions`, `r/EngineeringResumes`, `r/recruitinghell`, `r/csMajors`, `r/jobs` or `r/layoffs`) cover the SWE-career complaint space. Cluster complaints, ship one landing page per cluster as a RoleNext positioning hypothesis, drop links in value-add comments, let CTR + signup gate the offers.

## What Changes

- Add `pipelines/reddit-pmf/` with a three-phase weekly DAG: `scrape` → `extract` → `deploy`, all gates `auto_pass`. Cron: weekly (Monday 8 AM).
- Scrape phase pulls top 50 posts per subreddit per week (5 subreddits, ~250 posts).
- Extract phase clusters posts by complaint pattern (e.g. "ATS killed my resume", "ghosted after final round", "no callbacks after 200 apps") and emits one landing-page hypothesis per cluster (target: 5 hypotheses per week).
- Deploy phase generates landing-page content (headline, hero copy, signup CTA, social proof placeholder) and triggers Vercel branch deploys — one branch per hypothesis. Output is N URLs.
- Add `/reddit-pmf` dashboard route showing weekly batches: clusters, hypotheses, deploy URLs, and CTR/signup metrics fetched from Vercel Analytics + a thin signup-counter endpoint.
- Wire the existing slop engine to the extract phase (different rule pack tuned for Reddit voice).
- The "market gate" is real: a thin scheduled task once weekly checks each hypothesis's CTR + signup rate and archives losers, promotes winners (manual captain decision on what to do with a winner — usually fold into main RoleNext positioning).

## Capabilities

### New Capabilities
- `reddit-pmf`: zero-gate weekly pipeline that turns Reddit complaint patterns into deployed landing-page hypotheses

### Modified Capabilities
<!-- none -->

## Impact

- New dependencies: Reddit API (PRAW-equivalent or direct OAuth), Vercel API for branch deploys.
- New env vars: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` for the landing-page repo.
- Assumes a separate landing-page repo exists with a Vercel project configured for branch deploys. A minimal Next.js or SvelteKit static landing template SHALL be scaffolded at `pipelines/reddit-pmf/landing-template/` for the first deploy.
- One new cron entry: weekly Monday 8 AM.
- One new cron entry: weekly Friday 5 PM (metrics sweep).
- Slop rule pack: `pipelines/reddit-pmf/slop-rules/` tuned for Reddit-native voice (sounds-like-a-human is the highest priority filter here).
