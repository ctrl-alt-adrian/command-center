## 1. Vault Layout

- [ ] 1.1 Create twelve pillar directories under `vault/`: mapping, agents, context, harness, intuition, natural-language, engineering, general, mindset, free-lunch, youtube-videos, build-journal
- [ ] 1.2 Write a starter `Map of Content.md` for each pillar
- [ ] 1.3 Define the atomic-note schema in `core/lib/vault.ts` and a sample note as documentation
- [ ] 1.4 Add `VAULT_ROOT` and `LEGACY_SESSIONS_ROOT` to `.env.example`

## 2. Vault Reader

- [ ] 2.1 Implement `core/lib/vault.ts`: `listNotes`, `readNote`, `parseFrontmatter`, `resolveWikilinks`
- [ ] 2.2 Add validation: missing required frontmatter logs a warning and excludes the file
- [ ] 2.3 Implement orphan-wikilink tracking returning `{ sourcePath, targetName }` tuples
- [ ] 2.4 Unit test: parse a sample note, resolve a wikilink, detect an orphan

## 3. KB Scanner Update

- [ ] 3.1 Extend marketing-pipeline's KB scanner to walk `$VAULT_ROOT` AND `$LEGACY_SESSIONS_ROOT`
- [ ] 3.2 Tag results with `source: 'vault'` or `source: 'legacy'`
- [ ] 3.3 Verify: a discovery run after vault adoption produces candidates from both roots

## 4. Extract Phase

- [ ] 4.1 Author `pipelines/vault-nuggets/cli/extract.md` claude prompt
- [ ] 4.2 Implement source scan: legacy sessions since last extract, build-journal since last extract
- [ ] 4.3 Implement dedup vs. live vault (Jaccard 0.55 on summary tokens)
- [ ] 4.4 Stage candidates in `vault/.staging/<task-id>/` with frontmatter + body + Related
- [ ] 4.5 Write `dropped.json` for candidates filtered by dedup

## 5. Embed Phase

- [ ] 5.1 Implement file move from `.staging/` to target pillar
- [ ] 5.2 Implement missing-target stub creation (`content_ready: false`)
- [ ] 5.3 Update pillar `Map of Content.md` with new entries

## 6. Pipeline Registration

- [ ] 6.1 Author `pipelines/vault-nuggets/pipeline.config.ts` (extract → review → embed)
- [ ] 6.2 Wire into core registry
- [ ] 6.3 Add 9 AM cron entry to `cron/cron.txt`

## 7. /vault Surface

- [ ] 7.1 Build `/vault` route: pillar tree, per-pillar counts, recent notes
- [ ] 7.2 Build pending-extracts subpage listing needs_review nugget tasks
- [ ] 7.3 Build staging review UI: per-candidate approve/reject with proposed frontmatter visible
- [ ] 7.4 Wire approval action to embed phase

## 8. Manual Journal Command

- [ ] 8.1 Add `cli/log-journal.sh <project> <message>` writing directly to `vault/build-journal/` as a build-journal note

## 9. Initial Backfill

- [ ] 9.1 Run extract over the existing `~/Documents/rolenext/sessions/` corpus once
- [ ] 9.2 Captain reviews the initial extraction in /vault
- [ ] 9.3 Approved candidates populate the vault as seed content
