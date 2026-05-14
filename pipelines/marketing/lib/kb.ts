import fs from "fs/promises";
import path from "path";
import { KB_DIR } from "./paths.ts";
import type { KBEntry } from "./types.ts";

export async function getKBEntries(): Promise<KBEntry[]> {
  // Vault is the sole source of truth for marketing's KB. Rolenext sessions
  // are raw material that vault-nuggets mines into atomic notes — pulling
  // them in here too would cause duplicate-content risk (one idea surfacing
  // as both a session and the atomic note extracted from it).
  const vault = await readVaultNotes().catch(() => [] as KBEntry[]);
  vault.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return vault;
}

async function readVaultNotes(): Promise<KBEntry[]> {
  const { listNotes } = await import("../../../core/lib/vault.ts");
  const notes = await listNotes();
  return notes
    // Skip Map-of-Content stubs — they're indexes, not content
    .filter((n) => n.filename.toLowerCase() !== "map of content")
    // Audience filter: marketing-product surfaces notes tagged audience: product
    // or audience: both or untagged. Notes tagged audience: brand are reserved
    // for the personal-brand pipeline.
    .filter((n) => {
      const audience =
        typeof n.frontmatter.audience === "string"
          ? (n.frontmatter.audience as string).toLowerCase()
          : null;
      return audience !== "brand";
    })
    .map((n) => {
      const tier = typeof n.frontmatter.tier === "number" ? n.frontmatter.tier : 2;
      const contentReady = n.frontmatter.content_ready === true;
      return {
        id: `vault:${n.pillar}:${n.filename}`,
        filename: n.relPath,
        date: (n.frontmatter.created as string) ?? "",
        project: String(n.pillar),
        summary: (n.frontmatter.title as string) || n.summary,
        tags: Array.isArray(n.frontmatter.tags) ? (n.frontmatter.tags as string[]) : [],
        contentAngles: [],
        // Vault notes are pre-curated: tier-1 are framework notes, treat as shareworthy.
        shareworthy: tier === 1,
        usedForContent: false,
        body: n.body,
        contentWorthy: contentReady ? true : undefined,
        contentType: undefined,
      } as KBEntry;
    });
}

export async function getKBEntry(id: string): Promise<KBEntry | null> {
  const entries = await getKBEntries();
  return entries.find((e) => e.id === id) ?? null;
}

export async function markUsedForContent(id: string): Promise<void> {
  // KB ids now have the form `vault:<pillar>:<filename>` (legacy session ids
  // are no longer surfaced). path.join(KB_DIR, `${id}.md`) won't resolve to a
  // real file for vault entries, so this currently no-ops for everything.
  // Proper vault writeback (set `usedForContent: true` in the note's
  // frontmatter so discovery skips it next run) is tracked by the
  // `fix-marketing-review-side-effects` OpenSpec proposal.
  const filePath = path.join(KB_DIR, `${id}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const updated = raw.replace(
      /^usedForContent:\s*false$/m,
      "usedForContent: true"
    );
    await fs.writeFile(filePath, updated, "utf-8");
  } catch {
    // File not found or not writable — skip silently
  }
}

export interface KBAnalysis {
  contentWorthy: boolean;
  contentType?: "technical" | "marketing";
  hook?: string;
  angle?: string;
}

export async function writeKBAnalysis(
  id: string,
  analysis: KBAnalysis
): Promise<void> {
  const filePath = path.join(KB_DIR, `${id}.md`);
  try {
    let raw = await fs.readFile(filePath, "utf-8");
    const fields: Record<string, string> = {
      contentWorthy: String(analysis.contentWorthy),
      analyzedAt: new Date().toISOString().slice(0, 10),
    };
    if (analysis.contentType) fields.contentType = analysis.contentType;
    if (analysis.hook) fields.hook = analysis.hook;
    if (analysis.angle) fields.angle = analysis.angle;

    // Split frontmatter from body to safely insert new fields
    const parts = raw.split("---");
    if (parts.length < 3) return;
    let frontmatter = parts[1];

    for (const [key, value] of Object.entries(fields)) {
      const regex = new RegExp(`^${key}:.*$`, "m");
      if (regex.test(frontmatter)) {
        frontmatter = frontmatter.replace(regex, `${key}: ${value}`);
      } else {
        frontmatter = frontmatter.trimEnd() + `\n${key}: ${value}\n`;
      }
    }

    raw = `---${frontmatter}---${parts.slice(2).join("---")}`;

    await fs.writeFile(filePath, raw, "utf-8");
  } catch {
    // File not found or not writable — skip silently
  }
}

export async function getRecentKBEntries(days: number): Promise<KBEntry[]> {
  const all = await getKBEntries();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return all.filter((entry) => entry.date >= cutoffStr);
}
