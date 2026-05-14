## 1. Refinement prompt

- [ ] 1.1 Author `pipelines/marketing/cli/refine-post.md`: framing "you are rewriting an existing draft to apply a user instruction", embed the voice rules from `write-post-shared.md`, output ONLY the refined draft

## 2. Lib refactor — generateSinglePlatform

- [ ] 2.1 In `pipelines/marketing/lib/generate.ts`, expose `generateSinglePlatform(platform, topic, kbContext, context)` that wraps the per-platform body of `generateDrafts`
- [ ] 2.2 `generateDrafts` calls `generateSinglePlatform` in its existing parallel loop — no behavioral change
- [ ] 2.3 Both helpers accept an optional override `{ angle?: string; hook?: string }` for regenerate-with-tweaks

## 3. Refine endpoint

- [ ] 3.1 `POST /api/marketing/drafts/[date]/refine/+server.ts` accepts `{ platform: string, instruction: string }`
- [ ] 3.2 Read `drafts/<date>/<platform>.md`, load `cli/refine-post.md`, build prompt, call `claude(prompt)`
- [ ] 3.3 Write the response back to the same file; run slop check; return `{ content, slop }`
- [ ] 3.4 Error handling: claude timeout / write failure → return 500 with reason

## 4. Regenerate endpoint

- [ ] 4.1 `POST /api/marketing/drafts/[date]/regenerate/[platform]/+server.ts` accepts optional `{ angle?: string, hook?: string }`
- [ ] 4.2 Read `meta.json` for topic + kbContext + candidate metadata
- [ ] 4.3 Call `generateSinglePlatform`, write result, run slop check, return `{ content, slop }`

## 5. Slop-check endpoint

- [ ] 5.1 `POST /api/marketing/drafts/[date]/slop-check/+server.ts` accepts optional `{ platform?: string }`
- [ ] 5.2 Load slop pack (idempotent), read draft(s), return `{ [platform]: SlopResult }`

## 6. Status endpoint

- [ ] 6.1 `POST /api/marketing/drafts/[date]/status/+server.ts` accepts `{ platform: string, status: DraftStatus }`
- [ ] 6.2 Update `drafts/<date>/status.json` via `updateDraftStatus` from `pipelines/marketing/lib/drafts.ts`
- [ ] 6.3 Return the updated status map

## 7. Editor UI

- [ ] 7.1 In `dashboard/src/routes/marketing/drafts/[slug]/+page.svelte`:
  - Add a controls row above the markdown view: instruction text input + Refine button, Regenerate button, Slop-check button, status dropdown
  - Local state for in-flight action (disable all controls while one is running)
  - Inline error banner for failed actions
- [ ] 7.2 Refine: POST + update local content + slop result optimistically
- [ ] 7.3 Regenerate: confirm prompt, POST, update local content
- [ ] 7.4 Slop-check: POST, update slop result
- [ ] 7.5 Status: POST on change, update local badge

## 8. Verification

- [ ] 8.1 Use an existing draft (manually drag one in via marketing-pipeline if needed)
- [ ] 8.2 Visit `/marketing/drafts/<slug>`, switch to linkedin tab
- [ ] 8.3 Type "shorten by 40%" + click Refine; observe new content, new slop result
- [ ] 8.4 Click Regenerate, confirm prompt, observe fresh content
- [ ] 8.5 Click Slop-check, observe violations panel updates
- [ ] 8.6 Change status to "posted"; reload page, status persisted
