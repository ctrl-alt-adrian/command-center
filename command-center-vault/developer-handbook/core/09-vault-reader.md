# Core 09 — The Vault Reader (`core/lib/vault.ts`)

The vault is an Obsidian-style folder of markdown notes organized into twelve "pillars." `vault.ts` is the read-only parser for it: it walks the directory, parses YAML frontmatter, extracts `[[wikilinks]]`, validates a light schema, resolves links across notes, and finds orphans. It also reads a separate "legacy sessions" folder. Pipelines that mine the vault for content (notably `vault-nuggets`) build on these functions.

> Prereqs: [01-data-model.md](01-data-model.md) for general type conventions. Paths come from [`paths.ts`](10-utilities.md). Cross-references: [`../vault/01-machine-framework.md`](../vault/01-machine-framework.md), [`../pipelines/vault-nuggets.md`](../pipelines/vault-nuggets.md).

---

## The pillars

```ts
// core/lib/vault.ts:7-21
export const PILLARS = [
  "mapping",
  "agents",
  "context",
  "harness",
  "intuition",
  "natural-language",
  "engineering",
  "general",
  "mindset",
  "free-lunch",
  "youtube-videos",
  "build-journal",
] as const;
export type Pillar = (typeof PILLARS)[number];
```

Twelve pillar names, `as const` so `Pillar` is the exact string-literal union of them. A note's pillar is **its top-level directory under `VAULT_ROOT`** — anything not in one of these twelve dirs is not treated as a note (see `listNotesUncached`).

---

## Frontmatter and note types

```ts
// core/lib/vault.ts:23-45
export interface NoteFrontmatter {
  pillar?: string;
  title?: string;
  tier?: 1 | 2 | 3 | number;
  content_ready?: boolean;
  created?: string;
  tags?: string[];
  aliases?: string[];
  [extra: string]: unknown;
}

export interface VaultNote {
  path: string;            // absolute path
  relPath: string;         // relative to VAULT_ROOT
  pillar: Pillar | string; // directory-derived, used even if frontmatter missing it
  filename: string;        // basename without extension; doubles as wikilink target
  frontmatter: NoteFrontmatter;
  summary: string;         // first non-empty paragraph after frontmatter
  body: string;            // full body (sans frontmatter)
  related: string[];       // wikilink targets found in body
  warnings: string[];      // schema-validation issues
}
```

`NoteFrontmatter` has known fields plus an open `[extra: string]: unknown` index signature, so unknown YAML keys are kept, not rejected. `VaultNote` is the parsed view: absolute + relative path, the directory-derived `pillar`, the `filename` (which doubles as the wikilink target), the parsed `frontmatter`, a `summary`, the `body` (frontmatter stripped), the `related` wikilink targets, and `warnings` from schema validation.

---

## `parseFrontmatter` — YAML + the Date coercion

```ts
// core/lib/vault.ts:47-66
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseFrontmatter(raw: string): { meta: NoteFrontmatter; body: string } {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { meta: {}, body: raw };
  try {
    const meta = (yaml.load(m[1]) as NoteFrontmatter) ?? {};
    // js-yaml parses unquoted ISO date scalars (e.g. `created: 2026-05-14`) as
    // JavaScript Date objects. Every caller treats these fields as strings —
    // coerce here so the NoteFrontmatter contract holds at runtime.
    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Date) {
        meta[key] = value.toISOString().slice(0, 10);
      }
    }
    return { meta, body: raw.slice(m[0].length) };
  } catch {
    return { meta: {}, body: raw };
  }
}
```

Uses [`js-yaml`](https://www.npmjs.com/package/js-yaml). A leading `---\n...\n---` block is the frontmatter; no block → `{ meta: {}, body: raw }`. **The key subtlety:** js-yaml parses unquoted ISO dates (`created: 2026-05-14`) into JavaScript `Date` objects. Since every caller treats those as strings, the loop coerces any `Date` value back to a `YYYY-MM-DD` string (`.toISOString().slice(0, 10)`). A YAML parse error is swallowed → `{ meta: {}, body: raw }` (the note is still usable, just frontmatter-less).

> **Goodbye note:** If you add a frontmatter field that holds a date/time and you need the *time* component, this coercion will truncate it to the date. The slice-to-10 is deliberate for the existing `created`-style fields; widen it carefully if you need timestamps.

---

## `extractWikilinks`

```ts
// core/lib/vault.ts:68-78
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
export function extractWikilinks(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    // Strip "|alias" if present: [[Target|Alias]] → Target
    const target = m[1].split("|")[0].trim();
    if (target) out.add(target);
  }
  return [...out];
}
```

Finds every `[[...]]`, strips an `|Alias` suffix (so `[[Target|Alias]]` → `Target`), trims, and dedupes via a `Set`. Returns unique targets. (The module-level `WIKILINK_RE` is global/stateful; since it's fully consumed by each `while` loop to `null`, `lastIndex` resets to 0 — but note it's shared module state, so this function is not safe to call re-entrantly on the same regex; in practice it's called sequentially.)

---

## `firstParagraph` (internal) and `validate` (internal)

```ts
// core/lib/vault.ts:80-105
function firstParagraph(body: string): string {
  const lines = body.split(/\r?\n/);
  let buf: string[] = [];
  let started = false;
  for (const line of lines) {
    if (/^\s*$/.test(line)) {
      if (started) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;   // skip headings
    started = true;
    buf.push(line.trim());
  }
  return buf.join(" ").trim();
}

function validate(meta: NoteFrontmatter, pillarFromDir: string): string[] {
  const warnings: string[] = [];
  if (!meta.pillar) warnings.push("missing frontmatter: pillar");
  else if (meta.pillar !== pillarFromDir) warnings.push(`frontmatter pillar (${meta.pillar}) disagrees with directory (${pillarFromDir})`);
  if (!meta.title) warnings.push("missing frontmatter: title");
  if (meta.tier == null) warnings.push("missing frontmatter: tier");
  if (meta.content_ready == null) warnings.push("missing frontmatter: content_ready");
  return warnings;
}
```

`firstParagraph` returns the first non-empty, non-heading paragraph (used as the fallback summary). `validate` produces non-fatal `warnings`: missing `pillar`/`title`/`tier`/`content_ready`, or a frontmatter `pillar` that disagrees with the directory. These never block reading — they surface as `note.warnings` for the dashboard/health views.

---

## `readNote`

```ts
// core/lib/vault.ts:107-129
export async function readNote(absPath: string, vaultRoot: string = VAULT_ROOT): Promise<VaultNote | null> {
  let raw: string;
  try {
    raw = await fs.readFile(absPath, "utf-8");
  } catch {
    return null;
  }
  const relPath = path.relative(vaultRoot, absPath);
  const pillar = relPath.split(path.sep)[0];
  const filename = path.basename(absPath, path.extname(absPath));
  const { meta, body } = parseFrontmatter(raw);
  return {
    path: absPath,
    relPath,
    pillar,
    filename,
    frontmatter: meta,
    summary: (meta.title as string) || firstParagraph(body),
    body,
    related: extractWikilinks(body),
    warnings: validate(meta, pillar),
  };
}
```

Reads one file into a `VaultNote`. `pillar` is the first path segment of `relPath` (the top-level dir). `summary` is the frontmatter `title` if present, else the first paragraph. Unreadable file → `null`.

---

## `walkDir` (internal) — recursive `.md` scan

```ts
// core/lib/vault.ts:131-149
async function walkDir(dir: string, into: string[] = []): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return into;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip dotted (e.g. .staging/) and node_modules-ish dirs
      if (e.name.startsWith(".")) continue;
      await walkDir(p, into);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      into.push(p);
    }
  }
  return into;
}
```

Recursively collects `.md` file paths. **Skips any directory whose name starts with `.`** (e.g. `.staging/`, `.obsidian/`). Missing dir → returns what it has so far (no throw).

---

## `listNotes` — the cached scan

```ts
// core/lib/vault.ts:151-173
async function listNotesUncached(root: string, pillar?: Pillar | string): Promise<VaultNote[]> {
  const dir = pillar ? path.join(root, pillar) : root;
  const files = await walkDir(dir);
  const known = new Set<string>(PILLARS);
  const loaded = await Promise.all(files.map((f) => readNote(f, root)));
  return loaded.filter((n): n is VaultNote => n !== null && known.has(n.pillar));
}

const defaultNotesCache = ttlCache(() => listNotesUncached(VAULT_ROOT), 5000);

export function bustNotesCache(): void {
  defaultNotesCache.bust();
}

export async function listNotes(opts: { pillar?: Pillar | string; vaultRoot?: string } = {}): Promise<VaultNote[]> {
  const root = opts.vaultRoot ?? VAULT_ROOT;
  if (root === VAULT_ROOT && !opts.pillar) return defaultNotesCache.get();
  return listNotesUncached(root, opts.pillar);
}
```

`listNotesUncached` walks, reads every file in parallel, and **keeps only notes whose `pillar` is one of the twelve `PILLARS`** — so files at the vault root (e.g. `vault/README.md`, or this very handbook under `vault/developer-handbook/`) and files in unknown dirs are excluded.

`listNotes` caches **only the common case** (default `VAULT_ROOT`, all pillars) behind a **5-second TTL cache** ([10-utilities.md](10-utilities.md)). A pillar-scoped scan or an alternate `vaultRoot` bypasses the cache (rare enough). `bustNotesCache()` invalidates the default cache after a write.

> **Goodbye note:** the developer handbook you are reading lives under `vault/developer-handbook/`, which is **not** one of the twelve pillar directories — so `listNotes()` will never return these handbook pages as vault notes, and pipelines that consume the vault won't ingest them. That's intentional; the handbook is documentation about the system, not vault content.

---

## `resolveWikilinks` and `listOrphanLinks`

```ts
// core/lib/vault.ts:185-212
export async function resolveWikilinks(notes: VaultNote[]): Promise<ResolvedWikilink[]> {
  const index = new Map<string, VaultNote>();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  for (const n of notes) {
    index.set(norm(n.filename), n);
    const title = n.frontmatter.title;
    if (typeof title === "string") index.set(norm(title), n);
    const aliases = n.frontmatter.aliases;
    if (Array.isArray(aliases)) {
      for (const a of aliases) {
        if (typeof a === "string") index.set(norm(a), n);
      }
    }
  }
  const out: ResolvedWikilink[] = [];
  for (const n of notes) {
    for (const t of n.related) {
      out.push({ source: n.relPath, target: t, resolved: index.get(norm(t)) ?? null });
    }
  }
  return out;
}

export async function listOrphanLinks(notes?: VaultNote[]): Promise<ResolvedWikilink[]> {
  const allNotes = notes ?? (await listNotes());
  const resolved = await resolveWikilinks(allNotes);
  return resolved.filter((r) => r.resolved === null);
}
```

`resolveWikilinks` builds a lookup index keyed by **normalized** (lowercased, whitespace-collapsed, trimmed) `filename`, `title`, and each `alias`. Then for every note's `related` targets it produces a `{ source, target, resolved }` triple (`resolved` is the matched note or `null`). `listOrphanLinks` returns only the `null` ones — i.e. `[[links]]` that point at nothing in the vault. The dashboard's vault-health view uses this.

`ResolvedWikilink` type (`vault.ts:175-179`): `{ source: string; target: string; resolved: VaultNote | null }`.

---

## `listLegacySessions` — the separate legacy feed

```ts
// core/lib/vault.ts:214-256
export interface LegacySessionEntry {
  source: "legacy";
  id: string;
  path: string;
  date: string;
  project: string;
  summary: string;
  body: string;
  shareworthy: boolean;
  usedForContent: boolean;
}

export async function listLegacySessions(): Promise<LegacySessionEntry[]> {
  let files: string[];
  try {
    files = await fs.readdir(LEGACY_SESSIONS_ROOT);
  } catch {
    return [];
  }
  const out: LegacySessionEntry[] = [];
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    const p = path.join(LEGACY_SESSIONS_ROOT, f);
    const raw = await fs.readFile(p, "utf-8").catch(() => "");
    if (!raw) continue;
    const { meta, body } = parseFrontmatter(raw);
    out.push({
      source: "legacy",
      id: path.basename(f, ".md"),
      path: p,
      date: (meta.date as string) ?? "",
      project: (meta.project as string) ?? "",
      summary: (meta.summary as string) ?? "",
      body,
      shareworthy: Boolean(meta.shareworthy),
      usedForContent: Boolean(meta.usedForContent ?? meta.used_for_content),
    });
  }
  out.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return out;
}
```

Reads `LEGACY_SESSIONS_ROOT` (a **flat** directory of `.md` files, default `$HOME/Documents/rolenext/sessions` — see [`paths.ts`](10-utilities.md)). It is **not** recursive and ignores the pillar structure entirely. Each file becomes a `LegacySessionEntry` with minimal frontmatter extraction (`date`, `project`, `summary`, `shareworthy`, and `usedForContent` which accepts both camelCase and `used_for_content`). Sorted by `date` descending. Missing root → `[]`. Callers that want a unified "vault + legacy" feed merge this with `listNotes()`.

---

## Where to go next

- [`../pipelines/vault-nuggets.md`](../pipelines/vault-nuggets.md) — the pipeline that mines vault notes for content.
- [`../vault/01-machine-framework.md`](../vault/01-machine-framework.md) — the pillar structure and authoring conventions.
- [10-utilities.md](10-utilities.md) — `ttlCache` (the 5s notes cache) and `paths.ts` (`VAULT_ROOT`, `LEGACY_SESSIONS_ROOT`).
