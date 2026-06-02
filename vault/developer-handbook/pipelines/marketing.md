# Pipeline: `marketing`

**Config:** `pipelines/marketing/pipeline.config.ts:192`

## Purpose (domain)

Daily content factory. Scans the vault knowledge base (+ external signals) for content-worthy ideas, lets the captain approve one, fans out per-platform draft generation, runs a deterministic AI-slop gate, then a final human review. Six platforms: `linkedin, x, instagram, facebook, reddit, blog` (`lib/constants.ts:3`). Outputs land as draft sets under `drafts/<date>_<slug>-<uid>/`.

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut / onExhausted | files read / written |
|---|---|---|---|---|
| `discovery` | needs_review | `getKBEntries()` → split into analyzed (`contentWorthy===true`) vs un-analyzed. Analyzed path → `discoverFromCandidates`; else `discoverContent` (Haiku KB-scan first). Both run signal-analyzer + dedup + scoring. | `fanOut`: one generate task per scored candidate, each carrying `{candidate, kbContext}` (`getKBEntry().body`). | reads vault notes (via `core/lib/vault.ts`), `signals/<date>/*.json`, past `drafts/*/meta.json`; persists KB analysis frontmatter (`writeKBAnalysis`, no-op for `vault:` ids — see Gap). |
| `generate` | auto_pass | `generateDrafts(topic, augmentedKbContext, …, existingDir)` — parallel Claude call per enabled platform, Haiku for `x/instagram/facebook` else default (Sonnet). Appends `gateRetryFeedback` to KB context on rewind. | — | writes `drafts/<dir>/<platform>.md`, `status.json`, `meta.json`. |
| `slop-check` | **deterministic** (3 retries) | `run()` just ensures the slop pack is loaded. | `check`: `runRules` over each enabled-platform draft using pack `marketing`; fail-severity violations → `pass:false` with feedback string. Passing drafts → status `slop-checked`. `onExhausted`: delete every disabled-platform draft + every enabled draft still carrying a fail-violation. | reads `drafts/<dir>/*.md` + `config.json`; deletes failing `.md` + status entries. |
| `review` | needs_review | no-op (`return { output: {} }`). | — | none. |

### Data flow

- **Input source:** cron POST to `/api/tasks` with `{"pipelineId":"marketing"}`. The cron line is **commented out** in `cron/cron.txt` (marketing still owned by the legacy `:3000` app), so today it's effectively manual.
- **Discovery rewind loop:** when `slop-check` fails, the processor rewinds to `generate` carrying `input.gateRetryFeedback`. `generate` reuses `input.draftDir` (`existingDir`) and prepends the violations to the KB context so Claude avoids them on the retry:

```ts
// pipelines/marketing/pipeline.config.ts:79-89
const gateRetryFeedback = (task.input.gateRetryFeedback as string) ?? "";
const existingDir = task.input.draftDir as string | undefined;
const topic = candidate.hook || candidate.angle || candidate.id;
const augmentedKbContext = gateRetryFeedback ? `${kbContext}\n\nPRIOR SLOP VIOLATIONS — avoid these:\n${gateRetryFeedback}` : kbContext;
const result = await generateDrafts(topic, augmentedKbContext, { angle: candidate.angle, tags: candidate.tags }, existingDir);
```

- **External tools shelled out:** none directly. External *signals* (`signals/<date>/github-trending.json`, `hackernews.json`, `devto.json`) are read by `lib/signals.ts`; the competitors pipeline and a separate `fetch-signals.sh` populate that dir.
- **On disk:** all draft sets under `drafts/` (`DRAFTS_DIR` = `core` drafts dir, via `lib/paths.ts:14`).

## Config knobs

- `backpressureCap: 5`, `perTickCap: 25` (its own budget so the fan-out drains fast), `fanOutBatchSize: 50` (approve once → 50 generate tasks `pending`, rest `paused_user` until "Resume next batch"), `cronSchedule: "0 11 * * *"` (`pipeline.config.ts:196-204`).
- `config.json` — platform enable/disable. Current: `{ "disabledPlatforms": ["instagram", "facebook", "reddit"] }`. Resolved by `getPlatformConfig()` (`lib/config.ts:27`); `setDisabledPlatforms` is the dashboard writer (atomic tmp+rename).
- `lib/constants.ts`: `MAX_SLOP_RETRIES = 3`, stage timeouts (`discover 5m`, `generate 4m`, `slop-check 30s`), `META_DUPLICATE_THRESHOLD = 0.4`, `BODY_DUPLICATE_THRESHOLD = 0.35`, `SLUG_MAX_LENGTH = 50`, and `SCORE_WEIGHTS` (audienceRelevance 0.30, uniqueness 0.25, hookStrength 0.20, timeliness 0.15, personalRelevance 0.10).

## Slop rules

Pack id **`marketing`** (`lib/slop-loader.ts:18`). `loadMarketingSlopPack()` loads every `*.yaml` under `slop-rules/` and `registerSlopPack`s them. `slop-rules/rules.yaml` has `banned_words` (e.g. `delve`/`empowering`/`tapestry` = `fail`; `leverage`/`robust`/`seamless` = `warn`) and `banned_patterns` (em-dash `—` = `fail`, "It's worth noting that" = `fail`, "as a …, I" = `fail`). A `(?i)` prefix becomes a case-insensitive regex (`yamlToRule`). Only **fail**-severity violations gate the task. Note: the `style_checks:` block at the bottom of `rules.yaml` is NOT consumed by `slop-loader.ts` (only `banned_words`/`banned_patterns` are parsed).

## Key helper functions (`lib/`)

- `kb.ts` — `getKBEntries(): Promise<KBEntry[]>` (vault is the sole KB source; filters out `audience: brand` notes, tier-1 = shareworthy), `getKBEntry(id)`, `writeKBAnalysis(id, analysis)`, `markUsedForContent(id)`.
- `generate.ts` — `discoverContent(entries)`, `discoverFromCandidates(candidates, entryCount, shareworthyCount)`, `generateDrafts(topic, kbContext, context?, existingDir?)`, internal `runKBScanner` (per-entry Haiku, parallel) + `runSignalAnalyzer` (Haiku).
- `dedup.ts` — `jaccard(a, b)`, `checkDuplicates(candidates)` (meta-level, threshold 0.4), `checkBodyDuplicate(newSlug, newBodies)` (body-level, 0.35).
- `scoring.ts` — `scoreCandidates(candidates, dedupResults, signals)` → ranked `ScoredCandidate[]` (5 weighted sub-scores).
- `signals.ts` — `getLatestSignals()`, `summarizeSignals(snapshot)`.
- `drafts.ts` — `getDraftSet(date)`, `updateDraftStatus`, `deleteDraftPlatform`, `deleteDraftSet`.
- `config.ts` — `getPlatformConfig()`, `setDisabledPlatforms(disabled)`.

### KB scanner — the discovery core

```ts
// pipelines/marketing/lib/generate.ts:49-77 (scanOneEntry)
const result = await claude(`${corePrompt}

Knowledge base entry:
--- ${entry.filename} ---
${meta}

${excerpt}

If this entry is content-worthy, respond with a single JSON object. If not, respond with null.`, HAIKU);
const trimmed = result.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
if (trimmed === "null" || trimmed === "[]") return null;
```

### Slop gate `check()`

```ts
// pipelines/marketing/pipeline.config.ts:112-149 (abridged)
const { enabled } = await getPlatformConfig();
const enabledSet = new Set<string>(enabled);
const violations = [];
for (const [platform, draft] of Object.entries(set.platforms)) {
  if (!enabledSet.has(platform)) continue;
  const result = runRules(draft.content, MARKETING_SLOP_PACK);
  if (!result.pass) {
    for (const v of result.violations) if (v.severity === "fail")
      violations.push({ platform, rule: v.ruleId, line: v.line, excerpt: v.excerpt });
  } else {
    await updateDraftStatus(draftDir, platform, "slop-checked");
  }
}
if (violations.length === 0) return { pass: true };
const feedback = violations.slice(0, 20).map((v) => `${v.platform} L${v.line} [${v.rule}]: "${v.excerpt}"`).join("\n");
return { pass: false, reason: feedback };
```

## Working-vs-stub verdict

**Working.** Discovery → generate → slop gate → review all run real Claude calls and real file IO. Rate-limit handling propagates (`generateDrafts` rethrows a `RateLimitError` if any platform hits one, so the processor requeues the whole task).

**One documented gap:** `markUsedForContent(id)` (`lib/kb.ts:58`) is effectively a **no-op for every current KB entry**. KB ids are now `vault:<pillar>:<filename>`, so `path.join(KB_DIR, ` ``${id}.md` ``)` never resolves to a real file and the read fails silently:

```ts
// pipelines/marketing/lib/kb.ts:58-76
export async function markUsedForContent(id: string): Promise<void> {
  // KB ids now have the form `vault:<pillar>:<filename>` (legacy session ids
  // are no longer surfaced) ... so this currently no-ops for everything.
  // Proper vault writeback ... is tracked by the
  // `fix-marketing-review-side-effects` OpenSpec proposal.
  const filePath = path.join(KB_DIR, `${id}.md`);
  try { ... } catch { /* File not found or not writable — skip silently */ }
}
```

Consequence: discovery does not mark an approved note as "used", so a note can resurface on a later run unless `content_ready`/`contentWorthy` frontmatter already gates it.

## Cross-links

- Gates / rewind semantics: [../core/04-gates.md](../core/04-gates.md), processor: [../core/03-processor.md](../core/03-processor.md)
- Slop engine: [../core/08-slop-engine.md](../core/08-slop-engine.md), Claude wrapper: [../core/06-claude-wrapper.md](../core/06-claude-wrapper.md)
- Vault reader (`getKBEntries` source): [../core/09-vault-reader.md](../core/09-vault-reader.md)
- Sibling using vault drafts in brand voice: [personal-brand.md](personal-brand.md)
