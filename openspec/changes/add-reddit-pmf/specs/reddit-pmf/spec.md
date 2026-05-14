## ADDED Requirements

### Requirement: Reddit-PMF pipeline runs a three-phase weekly DAG

The system SHALL register a `reddit-pmf` pipeline with phases `scrape`, `extract`, `deploy` — all gates `auto_pass`. A top-of-pipeline task SHALL be created weekly by a Monday 8 AM cron entry. The pipeline SHALL NOT use needs_review gates between phases; market signal downstream replaces human gating.

#### Scenario: Weekly scrape fires

- **WHEN** Monday 8 AM cron POSTs a top-of-pipeline task
- **THEN** a task enters scrape, then extract, then deploy without any human intervention

### Requirement: Scrape phase pulls top 50 posts per configured subreddit

The scrape phase SHALL fetch the top 50 posts of the past 7 days from each subreddit listed in `pipelines/reddit-pmf/subreddits.yaml` (default: `cscareerquestions`, `EngineeringResumes`, `recruitinghell`, `csMajors`, `jobs`). The scrape SHALL persist raw posts to the task output as `posts.json` containing post id, title, body, score, num_comments, permalink.

#### Scenario: Scrape completes for all subreddits

- **WHEN** scrape runs against the default 5-subreddit list
- **THEN** `posts.json` contains up to 250 entries with the required fields populated

#### Scenario: A subreddit fetch fails

- **WHEN** Reddit returns an error for one subreddit
- **THEN** scrape continues with remaining subreddits, records the failure in the task output, and the phase still completes successfully (partial data marked as such)

### Requirement: Extract phase clusters posts into 3–7 landing-page hypotheses

The extract phase SHALL invoke claude -p with the post corpus and a structured-output schema, producing 3–7 complaint-pattern clusters. Each cluster SHALL include: a name, a representative complaint quote, the underlying user pain, a positioning hypothesis ("RoleNext is the tool that ..."), and proposed headline/subhead/CTA strings. Extract SHALL run intra-phase slop checking with up to 3 retries; if the third attempt still produces violations the phase SHALL fail and surface the task with status `failed`.

#### Scenario: Extract produces 5 clusters

- **WHEN** extract runs over a healthy corpus
- **THEN** `clusters.json` contains 5 entries with all required fields

#### Scenario: Extract produces fewer than 3 clusters

- **WHEN** extract returns 2 clusters
- **THEN** the phase fails, the task is marked `failed`, and the captain is notified via `/tasks`

#### Scenario: Extract output triggers slop violations

- **WHEN** the initial claude output contains slop pattern violations
- **THEN** extract retries (up to 3 attempts) with violation feedback before either committing a clean output or failing the phase

### Requirement: Deploy phase ships one Vercel branch deploy per cluster

The deploy phase SHALL, for each cluster from extract: generate a complete landing-page content set, push a new branch to the landing-template repo with content files filled in, trigger a Vercel deploy of that branch, wait for deploy completion, and append the resulting URL + cluster metadata to `signals/reddit-pmf/hypotheses.json`.

#### Scenario: Deploy succeeds for all clusters

- **WHEN** 5 clusters are passed to deploy
- **THEN** 5 branches are created, 5 Vercel deploys complete, and 5 entries with `status: 'live'` and the deploy URL are appended to `hypotheses.json`

#### Scenario: One deploy fails

- **WHEN** Vercel returns an error for one of the 5 deploys
- **THEN** the failed cluster is recorded with `status: 'failed_deploy'` and the captain can retry it from `/reddit-pmf`; the other 4 deploys still complete

### Requirement: Metrics sweep is a separate weekly pipeline

The system SHALL register a `reddit-pmf-metrics` pipeline with a single auto_pass phase, fired weekly by a Friday 5 PM cron entry. The phase SHALL fetch CTR and signup-rate data for every `live` hypothesis in `hypotheses.json` for the prior 7 days and persist them at `signals/reddit-pmf/metrics-<date>.json`.

#### Scenario: Weekly sweep populates metrics

- **WHEN** Friday 5 PM cron fires and 5 live hypotheses exist
- **THEN** the sweep writes 5 metric records and updates a rolling `metrics-latest.json` symlink/file

### Requirement: /reddit-pmf dashboard surfaces hypotheses and metrics

The system SHALL serve `/reddit-pmf` showing a table of all hypotheses (live, archived, winner) with: cluster name, deploy URL, weekly CTR, weekly signups, lifetime signups, status. A "links awaiting placement" callout SHALL highlight any hypothesis deployed in the past 7 days whose CTR is still 0 (suggesting the captain has not yet dropped its Reddit comment links).

#### Scenario: Captain reviews this week's hypotheses

- **WHEN** the captain visits `/reddit-pmf` on Wednesday after a Monday deploy
- **THEN** the page shows the 5 new hypotheses with their URLs and a "links awaiting placement" callout for any that still show zero clicks
