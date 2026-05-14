import { error } from "@sveltejs/kit";
import path from "path";
import { readNote, listNotes, resolveWikilinks, PILLARS } from "../../../../../../core/lib/vault.ts";
import { VAULT_ROOT } from "../../../../../../core/lib/paths.ts";

export async function load({ params }) {
  if (!(PILLARS as readonly string[]).includes(params.pillar)) {
    throw error(404, `unknown pillar: ${params.pillar}`);
  }
  const filename = decodeURIComponent(params.note);
  const absPath = path.join(VAULT_ROOT, params.pillar, `${filename}.md`);
  const note = await readNote(absPath);
  if (!note) throw error(404, `note not found: ${params.pillar}/${filename}`);

  // Resolve wikilinks against the full vault
  const all = await listNotes();
  const resolved = await resolveWikilinks([note]);

  return {
    pillar: params.pillar,
    note: {
      filename: note.filename,
      title: (note.frontmatter.title as string) || note.filename,
      tier: typeof note.frontmatter.tier === "number" ? note.frontmatter.tier : 2,
      content_ready: note.frontmatter.content_ready === true,
      created: (note.frontmatter.created as string) || "",
      tags: Array.isArray(note.frontmatter.tags) ? (note.frontmatter.tags as string[]) : [],
      aliases: Array.isArray(note.frontmatter.aliases) ? (note.frontmatter.aliases as string[]) : [],
      body: note.body,
      warnings: note.warnings,
      relPath: note.relPath,
    },
    related: resolved.map((r) => ({
      target: r.target,
      resolved: r.resolved
        ? { pillar: r.resolved.pillar, filename: r.resolved.filename, title: (r.resolved.frontmatter.title as string) || r.resolved.filename }
        : null,
    })),
  };
}
