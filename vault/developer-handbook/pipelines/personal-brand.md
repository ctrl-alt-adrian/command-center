# Pipeline: `personal-brand`

**Config:** `pipelines/personal-brand/pipeline.config.ts:10`

## Purpose (domain)

Personal-brand content pipeline — the brand-voice sibling of `marketing`. Discovery filters the vault for tier-1 framework notes whose audience is *not* `product` (i.e. brand/principle material), the captain reviews the picks, each pick fans out to a generate task producing per-platform drafts in Adrian's voice, and a final review lets the captain edit/refine before publishing. Output lands under `drafts/brand/<date>_<slug>-<uid>/`. **This pipeline currently has the most tasks on disk — 178** (`tasks/` grep for `personal-brand`).

## Phase-by-phase

| phase | gateType | what `run()` does | check / fanOut | files read / written |
|---|---|---|---|---|
| `discovery` | needs_review | `discoverBrandCandidates()` — **pure vault filter, NO Claude**: tier-1 + `content_ready` + `audience !== "product"`; build-journal notes only if `audience: "brand"`. | `fanOut`: one generate task per pick, carrying the note's `{id, pillar, filename, title, tier, tags, summary, body}`. | reads vault notes via `core/lib/vault.ts` `listNotes()`. |
| `generate` | auto_pass | `generateBrandDrafts({title, pillar, body, tags})` — 6 platforms in parallel, **Haiku for `x`, Sonnet for the rest**, using `cli/write-post.md` with `{{platform}}` substituted. Per-platform failures are non-fatal (`Promise.allSettled`). | none. | writes `drafts/brand/<slug>/<platform>.md`, `meta.json`. |
| `review` | needs_review | no-op (`{ output: { awaitingReview: true } }`). Captain edits/refines via the dashboard (`cli/refine-post.md`). | none. | none. |

### Data flow

- **Input source:** **manual** POST `/api/tasks` `{"pipelineId":"personal-brand"}` — no `cronSchedule`, no cron line.
- **Discovery is deterministic.** No model call — it's a frontmatter filter (`lib/discovery.ts`). Phase B of the project plans to layer Claude ranking on top, but the current `run()` just returns the filtered set.
- **Outputs:** drafts under `drafts/brand/` (`BRAND_DRAFTS_DIR`, `lib/paths.ts`). Six platforms: `linkedin, x, instagram, facebook, reddit, blog` (`lib/generate.ts:11`).

### discovery — the filter

```ts
// pipelines/personal-brand/lib/discovery.ts:31-54 (abridged)
for (const n of all) {
  const fm = n.frontmatter;
  const tier = typeof fm.tier === "number" ? fm.tier : 0;
  const contentReady = fm.content_ready === true;
  const audience = typeof fm.audience === "string" ? fm.audience.toLowerCase() : null;
  if (tier !== 1) continue;                                  // framework/principle notes only
  if (!contentReady) continue;                               // captain vouched for the prose
  if (audience === "product") continue;                      // product material → marketing pipeline
  if (n.pillar === "build-journal" && audience !== "brand") continue; // minutiae unless opted in
  out.push({ id: `vault:${n.pillar}:${n.filename}`, pillar, filename, title, tier, tags, summary, body,
    reason: audience === "brand" ? "explicit audience:brand" : `tier-1 ${n.pillar} principle (untagged audience)` });
}
```

This is the mirror of marketing's KB filter, which *excludes* `audience: brand`. The two pipelines partition the vault by audience.

### generate — parallel per-platform drafts

```ts
// pipelines/personal-brand/lib/generate.ts:73-92 (abridged)
const settled = await Promise.allSettled(BRAND_PLATFORMS.map(async (platform) => {
  const platformPrompt = writePromptTemplate.replaceAll("{{platform}}", platform);
  const prompt = `${platformPrompt}\n\n## Source vault note\n\nTitle: ${input.title}\nPillar: ${input.pillar}\n...\n${input.body}\n...\nWrite the ${platform} post now.`;
  const model = SHORT_FORM_PLATFORMS.has(platform) ? SHORT_FORM_HAIKU : SONNET; // x → Haiku, else Sonnet
  const content = await claude(prompt, { model, timeoutMs: 5 * 60 * 1000 });
  await fs.writeFile(path.join(draftDir, `${platform}.md`), content, "utf-8");
  return [platform, content] as const;
}));
// failures recorded as { error } per platform; never throws unless you read them
```

The generate phase reports `failedPlatforms` in its output (`pipeline.config.ts:75`) but does not fail the task — a single platform error leaves the other five drafts intact.

## Voice rules — enforced IN the prompt, NOT a slop pack

Unlike marketing/reddit-pmf, personal-brand has **no registered slop pack**. The AI-tell guardrails live as a HARD list inside `cli/write-post.md` (`## Voice rules (HARD)`):

> NEVER use any of these … em-dashes (—)/en-dashes anywhere; "Let's dive into"/"Let me break this down"/"buckle up"; "Here's the thing"/"Here's why"; "the truth is"/"the reality is"; "It's not just X, it's Y" parallelism; rhetorical multipliers (100%, 10x); "fellow founders/builders/engineers"; "in today's world"/"in the age of AI"/"in 2026"; "game-changer"/"no-brainer"/"low-hanging fruit"; closing with an engagement question; emoji-as-bullet; "leverage"/"synergy"/"unlock"/"empower"; "the X playbook/framework" unless the note names one.

Plus positive rules ("speak from experience", "concrete over abstract", "one idea per post", "drop the setup") and per-platform length/format specs. Because it's prompt-only, there's **no automated re-check** of these rules — generation is one-shot per platform, and the captain catches misses at the review/refine step.

## Config knobs

- `backpressureCap: 5`, **no `perTickCap`** (shares the global pool), `fanOutBatchSize: 25` (approve once → 25 generate tasks `pending`, rest `paused_user` until "Resume next batch"), **no `cronSchedule`** (`pipeline.config.ts:17-21`).
- Generate phase timeout 15m (6 parallel Claude calls). Review timeout 5s.
- `lib/generate.ts`: `SONNET = claude-sonnet-4-6`, `SHORT_FORM_HAIKU = claude-haiku-4-5-…`, `SHORT_FORM_PLATFORMS = {"x"}`, `SLUG_MAX_LENGTH = 64`.

## Key helper functions (`lib/`)

- `discovery.ts` — `discoverBrandCandidates(): Promise<BrandCandidate[]>`.
- `generate.ts` — `generateBrandDrafts(input): Promise<BrandGenerateResult>`; `BRAND_PLATFORMS`, internal `loadWritePrompt` (cached), `buildSlug`.
- `lib/paths.ts` — `BRAND_DRAFTS_DIR` (`drafts/brand`), `CLI_DIR`, `draftSetDir(slug)`.
- CLI prompts: `cli/write-post.md` (`{{platform}}` template with the HARD voice list), `cli/refine-post.md` (captain-driven refinement at review).

## Working-vs-stub verdict

**Working.** Discovery is a real (deterministic) vault filter; generate makes real Sonnet/Haiku calls and writes real draft files; review is a deliberate no-op awaiting the captain. The honest limitations are by design:

- **Discovery has no Claude ranking yet** — it returns the entire filtered set (could be hundreds), which is exactly why `fanOutBatchSize: 25` exists.
- **Voice enforcement is prompt-only** — no post-generation regex gate, so AI tells that slip past the prompt aren't auto-caught (the review/refine loop is the backstop).
- Per-platform generation failures are silently non-fatal; check `failedPlatforms` in the task output to know if a platform is missing.

## Cross-links

- Vault reader + frontmatter (`tier`, `content_ready`, `audience`): [../core/09-vault-reader.md](../core/09-vault-reader.md)
- Audience-partitioned sibling: [marketing.md](marketing.md)
- Where notes come from: [vault-nuggets.md](vault-nuggets.md), [../vault/02-how-content-lands.md](../vault/02-how-content-lands.md)
- Claude wrapper: [../core/06-claude-wrapper.md](../core/06-claude-wrapper.md)
