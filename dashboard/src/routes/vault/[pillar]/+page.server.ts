import { error } from "@sveltejs/kit";
import { listNotes, PILLARS } from "../../../../../core/lib/vault.ts";

export async function load({ params }) {
  if (!(PILLARS as readonly string[]).includes(params.pillar)) {
    throw error(404, `unknown pillar: ${params.pillar}`);
  }
  const notes = await listNotes({ pillar: params.pillar });
  return {
    pillar: params.pillar,
    notes: notes
      .filter((n) => n.filename.toLowerCase() !== "map of content")
      .map((n) => ({
        filename: n.filename,
        title: (n.frontmatter.title as string) || n.filename,
        tier: typeof n.frontmatter.tier === "number" ? n.frontmatter.tier : 2,
        content_ready: n.frontmatter.content_ready === true,
        tags: Array.isArray(n.frontmatter.tags) ? (n.frontmatter.tags as string[]) : [],
        created: (n.frontmatter.created as string) || "",
        summary: n.summary,
        warnings: n.warnings,
      })),
  };
}
