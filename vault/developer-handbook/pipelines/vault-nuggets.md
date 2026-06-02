# Pipeline: `vault-nuggets`

**Config:** `pipelines/vault-nuggets/pipeline.config.ts:5`

## Purpose (domain)

Daily atomic-note extractor. Mines new rolenext session exports and the vault build-journal for "nuggets" (atomic, MACHINE-framework notes), dedupes them against the live vault, stages survivors for captain review, and on approval writes them into their pillar directory — creating tier-3 stub files for unresolved wikilinks and appending to each pillar's Map of Content. This is the feed that keeps the vault (and therefore marketing's KB) growing. See [../vault/01-machine-framework.md](../vault/01-machine-framework.md).

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut / onExhausted | files read / written |
|---|---|---|---|---|
| `extract` | needs_review | `runExtract(task.id, ctx.outputDir)` — list new sources (mtime > checkpoint), Haiku-scan each into candidate JSON, dedup vs live vault + vs each other (jaccard ≥ 0.55), stage to `vault/.staging/<taskId>/`. | none (single advance). | reads `LEGACY_SESSIONS_ROOT/**.md` + `vault/build-journal/**.md`, `vault/.staging/.checkpoint.json`, live vault notes; writes `vault/.staging/<taskId>/NN-<slug>.json`, `dropped.json`, `scanned.json`, and `outputDir/summary.md`; updates checkpoint. |
| `embed` | auto_pass | `runEmbed(stagingTaskId, ctx.outputDir)` — only `status: approved` candidates → write `vault/<pillar>/<title>.md`, create tier-3 stubs for missing wikilink targets, append to `Map of Content.md`, bust the notes cache, remove the staging dir. | none. | reads `vault/.staging/<taskId>/*.json` + `decisions.json`; writes notes + stubs into `vault/<pillar>/`, appends to MoC; `bustNotesCache()`. |

### Data flow

- **Input source:** cron POST `/api/tasks` `{"pipelineId":"vault-nuggets"}` — active line in `cron/cron.txt` at `0 9 * * *`.
- **Source discovery is checkpoint-gated.** A single global checkpoint at `vault/.staging/.checkpoint.json` records `lastRunAt`; only sources with `mtimeMs > since` are scanned (`lib/sources.ts:43-53`). The checkpoint is bumped even when zero sources are found.
- **Staging → review → embed handoff:** extract stages candidate JSONs; the dashboard `/vault/staging` page calls `listStagedCandidates(taskId)` / `recordCandidateDecision(taskId, file, status)` to write `decisions.json`; embed reads `status: approved` only. `stagingTaskId` is threaded through the task input (falls back to `previousTaskId`/`task.id`, `pipeline.config.ts:43`).
- **External tools:** none. Claude via `core/lib/claude.ts` `claude(prompt, HAIKU)`.

## Config knobs

- `backpressureCap: 5`, `perTickCap: 1` (one extract task fully occupies a tick — it scans ~100 sources sequentially via Haiku), `cronSchedule: "0 9 * * *"` (`pipeline.config.ts:13-17`).
- Tunables in `lib/extract.ts`: `HAIKU` model, `SOURCE_BODY_LIMIT = 6_000` (per-source excerpt cap), `DEDUP_THRESHOLD = 0.55`. Phase timeouts: extract `30m`, embed `60s` (set in the config inline).

## Slop rules

**None.** This pipeline registers no slop pack.

## Key helper functions (`lib/`)

- `extract.ts` — `runExtract(taskId, outputDir): Promise<ExtractResult>`, `listStagedCandidates(taskId)`, `recordCandidateDecision(taskId, file, "approved"|"rejected")`, `candidateToMarkdown(c)`. Plus internal `scanOneSource(prompt, src)`.
- `embed.ts` — `runEmbed(taskId, outputDir): Promise<EmbedResult>` + internal `appendToMoc(pillar, title)`.
- `sources.ts` — `listLegacySessionSources(since)`, `listBuildJournalSources(since)` (both walk `*.md`, skip dotdirs + Map of Content).
- `dedup.ts` — `jaccard(a, b)` (token-set Jaccard, drops stopwords + tokens < 3 chars).

### Extract — dedup + staging

```ts
// pipelines/vault-nuggets/lib/extract.ts:120-148 (abridged)
const liveNotes = await listNotes();
const liveSummaries = liveNotes
  .filter((n) => n.filename.toLowerCase() !== "map of content")
  .map((n) => ({ filename: n.filename, summary: (n.frontmatter.title as string) ?? n.summary }));
for (const c of allCandidates) {
  const text = `${c.title} ${c.summary}`;
  const match = liveSummaries.find((n) => jaccard(text, `${n.filename} ${n.summary}`) >= DEDUP_THRESHOLD);
  if (match) dropped.push({ title: c.title, reason: `duplicate of vault note "${match.filename}"`, pillar: c.pillar });
  else survivors.push(c);
}
// survivors also deduped against each other (claude produces near-dupes across sources)
```

### Embed — write note + stubs

```ts
// pipelines/vault-nuggets/lib/embed.ts:40-77 (abridged)
const staged = await listStagedCandidates(taskId);
const approved = staged.filter((s) => s.status === "approved").map((s) => ({ file: s.file, candidate: s.candidate }));
for (const { file, candidate } of approved) {
  if (!isValidPillar(candidate.pillar)) { skipped.push(...); continue; }
  const targetPath = path.join(VAULT_ROOT, candidate.pillar, `${safeFilename(candidate.title)}.md`);
  if (await exists(targetPath)) { skipped.push({ file, reason: "note already exists" }); continue; } // never overwrites captain edits
  await fs.writeFile(targetPath, candidateToMarkdown(candidate), "utf-8");
  for (const target of candidate.related ?? []) { /* create tier-3 stub if wikilink target missing */ }
  await appendToMoc(candidate.pillar, candidate.title);
}
if (embedded.length > 0 || stubsCreated.length > 0) bustNotesCache();
```

Stubs are written with `tier: 3`, `content_ready: false`, `tags: [stub, auto-generated]` and a body that names the linking note (`embed.ts:73`).

## Working-vs-stub verdict

**Working.** Both phases do real Haiku scans, real dedup, and real vault writes. Safety properties worth knowing:

- Embed **never overwrites** an existing note (skips with reason), so captain-edited content is safe.
- Embed only removes the staging dir when `embedded.length > 0 || approved.length === staged.length` (`embed.ts:84`) — a partially-approved set with zero embeds keeps its staging dir.
- The notes cache is busted only when something changed, so a no-op embed doesn't thrash the reader.

## Cross-links

- How content lands in the vault: [../vault/02-how-content-lands.md](../vault/02-how-content-lands.md)
- Vault reader (`listNotes`, `bustNotesCache`, `PILLARS`): [../core/09-vault-reader.md](../core/09-vault-reader.md)
- MACHINE framework / pillars: [../vault/01-machine-framework.md](../vault/01-machine-framework.md)
- Downstream consumer (marketing KB): [marketing.md](marketing.md)
