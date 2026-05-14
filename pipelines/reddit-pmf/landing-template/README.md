# Landing template

A minimal landing-page scaffold used by the `reddit-pmf` deploy phase.

## How it works

Each deploy creates a `content.json` file with the cluster's headline, subhead, CTA, and a Reddit attribution. The page reads that file at request time and renders.

```
content.json   → headline, subhead, cta, attribution
index.html     → static shell
landing.js     → fetches content.json + renders
landing.css    → styles
```

## Two deploy modes

### Dry-run (default — no env vars needed)

The deploy phase writes one directory per cluster to `signals/reddit-pmf/<date>/<cluster-id>/` containing the rendered files. The captain can copy any subset into a separate landing-template repo and push manually.

### Vercel push (set `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` + `LANDING_REPO_PATH`)

The deploy phase:

1. cd's into `LANDING_REPO_PATH` (a separate git repo you control)
2. creates a new branch `pmf/<date>/<cluster-id>`
3. writes the content files
4. commits + pushes
5. calls Vercel REST API to trigger a deploy of that branch
6. polls for completion + grabs the URL
7. appends to `signals/reddit-pmf/hypotheses.json` with `status: "live"`

The landing repo is intentionally separate so this pipeline can't break the dashboard.

## Setup checklist (when you're ready to go live)

- [ ] Create a separate git repo with this template as the initial commit
- [ ] Add it as a Vercel project (auto-deploy on branch push)
- [ ] Set `VERCEL_PROJECT_ID` (visible in project settings)
- [ ] Generate a Vercel personal token at https://vercel.com/account/tokens, set `VERCEL_TOKEN`
- [ ] Set `LANDING_REPO_PATH` to the absolute path of the cloned repo
- [ ] Set `config.yaml`'s `force_dry_run: false` (default) — pipeline auto-detects mode
