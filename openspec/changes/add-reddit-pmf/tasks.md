## 1. Config and Auth

- [ ] 1.1 Author `pipelines/reddit-pmf/subreddits.yaml` with 5 starter subs
- [ ] 1.2 Author `pipelines/reddit-pmf/config.yaml` (target cluster count, slop retry max, scrape post limit)
- [ ] 1.3 Add `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `LANDING_REPO_PATH` to `.env.example`
- [ ] 1.4 Document Reddit app registration steps in `pipelines/reddit-pmf/README.md`

## 2. Landing Template

- [ ] 2.1 Scaffold `pipelines/reddit-pmf/landing-template/` as a minimal SvelteKit static template with placeholder slots: headline, subhead, hero copy, CTA text, signup form
- [ ] 2.2 Wire signup form to a thin endpoint that POSTs to a count store readable by the metrics sweep
- [ ] 2.3 Add a Vercel project pointing at this template's git repo

## 3. Scrape Phase

- [ ] 3.1 Implement `pipelines/reddit-pmf/lib/reddit.ts`: OAuth client + `getTopPosts(subreddit, timeframe)` returning normalized records
- [ ] 3.2 Implement the scrape phase orchestrator: fan-out over 5 subs in parallel, aggregate, write `posts.json`
- [ ] 3.3 Handle per-sub failure gracefully

## 4. Extract Phase

- [ ] 4.1 Author `pipelines/reddit-pmf/cli/extract.md` claude prompt with structured output schema (3–7 clusters)
- [ ] 4.2 Implement intra-phase slop check + retry loop (3 attempts)
- [ ] 4.3 Validate cluster count (3 ≤ N ≤ 7); fail the phase otherwise
- [ ] 4.4 Write `clusters.json` to task output

## 5. Slop Rules for Reddit Voice

- [ ] 5.1 Author `pipelines/reddit-pmf/slop-rules/*.yaml` with rules tuned for Reddit-native voice (no em-dashes, no AI tells, no "delve", no LinkedIn-isms)
- [ ] 5.2 Register the rule pack with core slop engine at pipeline startup

## 6. Deploy Phase

- [ ] 6.1 Implement `pipelines/reddit-pmf/lib/vercel.ts`: branch push + deploy trigger + poll for completion
- [ ] 6.2 Implement content-file generation from a cluster: write `content.json` files into the landing-template branch
- [ ] 6.3 Append each successful deploy to `signals/reddit-pmf/hypotheses.json` with `status: 'live'`
- [ ] 6.4 Record failed deploys with `status: 'failed_deploy'`

## 7. Pipeline Registration

- [ ] 7.1 Author `pipelines/reddit-pmf/pipeline.config.ts` (3 phases, all auto_pass)
- [ ] 7.2 Wire into registry
- [ ] 7.3 Add Monday 8 AM cron entry

## 8. Metrics Sweep

- [ ] 8.1 Implement `pipelines/reddit-pmf-metrics/lib/vercel-analytics.ts`: pull CTR for a given URL
- [ ] 8.2 Implement signup counter read endpoint
- [ ] 8.3 Author `pipelines/reddit-pmf-metrics/pipeline.config.ts` (1 phase, auto_pass)
- [ ] 8.4 Add Friday 5 PM cron entry

## 9. /reddit-pmf Surface

- [ ] 9.1 Build `/reddit-pmf` route: hypothesis table with cluster, URL, CTR, signups, status
- [ ] 9.2 Build "links awaiting placement" callout
- [ ] 9.3 Build status-change controls (live → archived, mark winner)

## 10. Smoke Test

- [ ] 10.1 Run the pipeline manually for 1 subreddit, 1 cluster, 1 deploy
- [ ] 10.2 Verify: URL is live, landing page renders, signup count increments on form POST
- [ ] 10.3 Scale to full 5-subreddit run on the following Monday cron
