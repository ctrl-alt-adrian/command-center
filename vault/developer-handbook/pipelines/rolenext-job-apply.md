# Pipeline: `rolenext-job-apply`

**Config:** `pipelines/rolenext/job-apply/pipeline.config.ts:7`

## Purpose (domain)

Bulk job-application prep against the rolenext **HTTP API** (not the repo). Discover jobs by analyzing each suggested resume title, let the captain approve the top picks, fan out one prep task per job (save → optimize resume → cover letter → download both PDFs), and gate a per-job `status=applied` PATCH after the captain submits the application externally. No vault, no slop, no Claude — all work is rolenext API calls.

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut | files written |
|---|---|---|---|---|
| `discover` | auto_pass | `runDiscover` — resolve resume id (latest if unset), pull the resume's suggested titles (≤6), `client.analyze` per title (SSE), dedupe by URL, drop `matchScore < 75`, rank by opportunity score, cap 200. | none. | `outputDir/candidates.json`, `candidates.md`. |
| `select` | **needs_review** | `runSelect` — take the top `applyLimit` (default 50), render a review markdown listing them. | `fanOut: fanOutSelect` → one prep task per picked job (`{candidate, resumeId}`). | `outputDir/review.md`, `selected.json`. |
| `prep` | **deterministic** (2 retries) | `runPrep` — `saveJob` → `optimizeResume` → `generateCoverLetter` → download `resume.pdf` + `cover.pdf` (parallel). Each call wrapped in `retryOnRateLimit`. | `check: checkPrep` — requires `jobId` + both PDF paths. | `outputDir/resume.pdf`, `cover.pdf`, `job.json`, `apply.md`. |
| `mark-applied` | **needs_review** | `runMarkApplied` — `client.patchJob(jobId, { status: "applied" })`. | none. | `outputDir/applied.md`. |

### Data flow

- **Input source:** **manual** POST `/api/tasks` `{"pipelineId":"rolenext-job-apply"}` — there is **no cron line** (`cron.txt` has none for this pipeline; the config has no `cronSchedule`).
- **Phase carry by file path:** discover emits `candidatesPath`; select reads it (also tolerates `task.output?.candidatesPath`) and emits `pickedPath`; `fanOutSelect` reads `pickedPath` and emits one `{candidate, resumeId}` per job.
- **External calls:** all to the rolenext API via `RoleNextClient` (`lib/api-client.ts`). `analyze` is a streamed SSE endpoint; save/optimize/cover/download/patch are plain REST. PDFs are served back to the dashboard via the generic task-file route `/api/tasks/[id]/files/[filename]` (e.g. `resume.pdf`, `cover.pdf`, `apply.md`).

### discover — analyze + rank

```ts
// pipelines/rolenext/job-apply/phases/discover.ts:50-83 (abridged)
for (const keyword of keywords) {                 // ≤ MAX_TITLES (6), sequential (5 req/s limit)
  if (candidates.length >= POOL_CAP) break;       // POOL_CAP = 200
  const results = await client.analyze({ keyword, location, remoteOnly: true, employmentTypes, resumeId });
  for (const r of results) {
    if (seenUrls.has(r.job.url)) continue;         // dedupe by URL
    seenUrls.add(r.job.url);
    if (r.matchScore < minMatchScore) { belowFloor++; continue; } // DEFAULT_MIN_MATCH_SCORE = 75
    candidates.push({ searchKeyword: keyword, result: r });
  }
}
candidates.sort(byScoreDesc);                      // opportunityScore ?? matchScore, desc
const top = candidates.slice(0, POOL_CAP);
```

### prep — the per-job pipeline

```ts
// pipelines/rolenext/job-apply/phases/prep.ts:14-46 (abridged)
const saved = await retryOnRateLimit(() => client.saveJob(body), ctx);          // 1. save
const optimize = await retryOnRateLimit(() => client.optimizeResume(saved.id), ctx); // 2. optimize
await retryOnRateLimit(() => client.generateCoverLetter(saved.id), ctx);        // 3. cover letter
const [resumePdf, coverPdf] = await Promise.all([                               // 4. download both
  retryOnRateLimit(() => client.downloadResume(saved.id), ctx),
  retryOnRateLimit(() => client.downloadCoverLetter(saved.id), ctx),
]);
// writes resume.pdf, cover.pdf, job.json, apply.md
```

`retryOnRateLimit` retries up to 3 attempts on `RoleNextRateLimitError`, sleeping `err.retryAfterMs` between (`prep.ts:89-103`).

## ⚠️ mark-applied — side effect happens BEFORE the gate

This is a subtle but important quirk. `mark-applied` is a `needs_review` phase, but the PATCH to `status=applied` happens inside `run()` — which executes **before** the human gate. So the rolenext job is flipped to `applied` first; the captain's review then merely confirms after the fact (it cannot prevent the PATCH):

```ts
// pipelines/rolenext/job-apply/phases/mark-applied.ts:6-12
export async function runMarkApplied(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const jobId = task.input.jobId as number | undefined;
  if (!jobId) throw new Error("mark-applied: missing jobId");
  const client = new RoleNextClient();
  const updated = await client.patchJob(jobId, { status: "applied" }); // <-- fires here, pre-gate
  ...
}
```

The intended human-in-the-loop step is the captain submitting the application *externally* (open apply URL, paste PDFs) — `apply.md` spells this out (`prep.ts:122-125`). The gate is a confirmation checkpoint, not a guard on the PATCH.

## Config knobs

- `backpressureCap: 5`, `perTickCap: 3` (sequential per task; cap low so a 50-job fan-out doesn't slam the rate limiter), `fanOutBatchSize: 10` (first 10 prep tasks `pending`, rest `paused_user` to pace optimize-budget spend), **no `cronSchedule`** (`pipeline.config.ts:16-22`).
- In-phase defaults: `DEFAULT_MIN_MATCH_SCORE = 75`, `MAX_TITLES = 6`, `POOL_CAP = 200`, `DEFAULT_LOCATION = "Remote"`, `DEFAULT_EMPLOYMENT_TYPES = "FULLTIME,CONTRACTOR"`, select `DEFAULT_LIMIT = 50`.
- Phase timeouts: discover 15m, select 1m, prep 8m, mark-applied 1m.

## Auth

`RoleNextClient` (`lib/api-client.ts`) needs `ROLENEXT_JWT` (a Clerk session token; base URL from `ROLENEXT_API_BASE` or a default). Without it the constructor throws `RoleNextAuthError` with instructions to run `await window.Clerk.session.getToken()` in a logged-in browser. Error types: `RoleNextAuthError` (401), `RoleNextRateLimitError` (429, carries `retryAfterMs`), `RoleNextHttpError` (other non-2xx).

## Slop rules

**None.** No vault, no Claude — nothing to slop-check.

## Key helper functions

- `discover.ts` — `runDiscover`, internal `resolveKeywords`, `byScoreDesc`, `renderSummary`.
- `select.ts` — `runSelect`, `fanOutSelect`, `renderReview`.
- `prep.ts` — `runPrep`, `checkPrep`, `toSaveBody`, `retryOnRateLimit`.
- `mark-applied.ts` — `runMarkApplied`.
- `lib/api-client.ts` — `RoleNextClient` with `latestResume`, `listResumes`, `suggestedTitles`, `analyze` (SSE), `saveJob`, `optimizeResume`, `generateCoverLetter`, `downloadResume`, `downloadCoverLetter`, `patchJob`, `billingUsage`.

## Working-vs-stub verdict

**Working** given a valid `ROLENEXT_JWT` and a ready resume in rolenext. The chain is fully implemented (real analyze/save/optimize/cover/download/patch). Caveats to know:

- The `mark-applied` PATCH-before-gate behavior above — treat the gate as confirmation, not authorization.
- `discover` **throws** if the resume returns no suggested titles, with a message to set the resume's analysis status to "ready" first (`discover.ts:113-116`).
- `prep` is a `deterministic` gate with 2 retries — a transient API failure that leaves it without a `jobId` or PDFs fails the `checkPrep` predicate and re-dispatches (then lands in `needs_review` if it exhausts).

## Cross-links

- Gates (`needs_review` select/mark-applied, `deterministic` prep): [../core/04-gates.md](../core/04-gates.md)
- Fan-out batching + `paused_user`: [../core/03-processor.md](../core/03-processor.md)
- Sibling rolenext pipeline: [rolenext-bug-resolver.md](rolenext-bug-resolver.md)
