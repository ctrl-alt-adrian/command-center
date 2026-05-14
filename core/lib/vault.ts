import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { VAULT_ROOT, LEGACY_SESSIONS_ROOT } from "./paths.ts";

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

export interface NoteFrontmatter {
  pillar?: string;
  title?: string;
  tier?: 1 | 2 | 3 | number;
  content_ready?: boolean;
  created?: string;
  tags?: string[];
  aliases?: string[];
  // Allow extra fields without erroring
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

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseFrontmatter(raw: string): { meta: NoteFrontmatter; body: string } {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { meta: {}, body: raw };
  try {
    const meta = (yaml.load(m[1]) as NoteFrontmatter) ?? {};
    return { meta, body: raw.slice(m[0].length) };
  } catch {
    return { meta: {}, body: raw };
  }
}

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

function firstParagraph(body: string): string {
  const lines = body.split(/\r?\n/);
  let buf: string[] = [];
  let started = false;
  for (const line of lines) {
    if (/^\s*$/.test(line)) {
      if (started) break;
      continue;
    }
    // Skip section headings when looking for summary
    if (/^#{1,6}\s/.test(line)) continue;
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

export async function listNotes(opts: { pillar?: Pillar | string; vaultRoot?: string } = {}): Promise<VaultNote[]> {
  const root = opts.vaultRoot ?? VAULT_ROOT;
  const dir = opts.pillar ? path.join(root, opts.pillar) : root;
  const files = await walkDir(dir);
  const out: VaultNote[] = [];
  const known = new Set<string>(PILLARS);
  for (const f of files) {
    const n = await readNote(f, root);
    if (!n) continue;
    // A note's "pillar" is its top-level directory under VAULT_ROOT. Anything
    // sitting at the root (vault/README.md) or in an unknown dir isn't a note.
    if (!known.has(n.pillar)) continue;
    out.push(n);
  }
  return out;
}

export interface ResolvedWikilink {
  source: string; // relPath of source note
  target: string; // wikilink target text
  resolved: VaultNote | null;
}

/**
 * Resolve [[Wikilinks]] across the vault. Case- and whitespace-insensitive
 * match against filenames (note title without `.md`) or frontmatter aliases.
 */
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

export async function listOrphanLinks(): Promise<ResolvedWikilink[]> {
  const notes = await listNotes();
  const resolved = await resolveWikilinks(notes);
  return resolved.filter((r) => r.resolved === null);
}

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

/** Walk LEGACY_SESSIONS_ROOT and return raw session entries with minimal parsing.
 *  Used by callers that want to unify vault + legacy into a single feed. */
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
