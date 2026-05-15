import fs from "fs/promises";
import path from "path";
import { VAULT_ROOT } from "../../../core/lib/paths.ts";
import { PILLARS, listNotes, bustNotesCache } from "../../../core/lib/vault.ts";
import { stagingDir } from "./paths.ts";
import { listStagedCandidates, candidateToMarkdown, type Candidate } from "./extract.ts";

export interface EmbedResult {
  embedded: Array<{ pillar: string; filename: string; path: string }>;
  stubsCreated: Array<{ pillar: string; target: string; path: string }>;
  skipped: Array<{ file: string; reason: string }>;
}

function safeFilename(title: string): string {
  // Preserve casing — wikilinks match case-insensitive — but strip unsafe chars
  return title.replace(/[\\/:*?"<>|]/g, "").trim() || "untitled";
}

function isValidPillar(p: string): boolean {
  return (PILLARS as readonly string[]).includes(p);
}

export async function runEmbed(taskId: string, outputDir: string): Promise<EmbedResult> {
  const staged = await listStagedCandidates(taskId);
  const approved = staged.filter((s) => s.status === "approved").map((s) => ({ file: s.file, candidate: s.candidate }));

  const embedded: EmbedResult["embedded"] = [];
  const stubsCreated: EmbedResult["stubsCreated"] = [];
  const skipped: EmbedResult["skipped"] = [];

  // Index existing notes for wikilink stub creation
  const existingNotes = await listNotes();
  const indexNorm = new Set<string>();
  for (const n of existingNotes) {
    indexNorm.add(n.filename.toLowerCase().replace(/\s+/g, " ").trim());
    const title = n.frontmatter.title;
    if (typeof title === "string") indexNorm.add(title.toLowerCase().replace(/\s+/g, " ").trim());
  }

  for (const { file, candidate } of approved) {
    if (!isValidPillar(candidate.pillar)) {
      skipped.push({ file, reason: `invalid pillar: ${candidate.pillar}` });
      continue;
    }
    const filename = safeFilename(candidate.title);
    const targetDir = path.join(VAULT_ROOT, candidate.pillar);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, `${filename}.md`);

    // If the target already exists, skip (don't overwrite captain-edited content)
    const exists = await fs.access(targetPath).then(() => true).catch(() => false);
    if (exists) {
      skipped.push({ file, reason: `note already exists at ${targetPath}` });
      continue;
    }

    const md = candidateToMarkdown(candidate);
    await fs.writeFile(targetPath, md, "utf-8");
    embedded.push({ pillar: candidate.pillar, filename: `${filename}.md`, path: targetPath });

    // Create stubs for missing wikilink targets, and add this note to its pillar's Map of Content
    for (const target of candidate.related ?? []) {
      const norm = target.toLowerCase().replace(/\s+/g, " ").trim();
      if (!norm) continue;
      if (indexNorm.has(norm)) continue;
      // Stage stub in the same pillar as the note that links to it
      const stubPath = path.join(VAULT_ROOT, candidate.pillar, `${safeFilename(target)}.md`);
      const stubExists = await fs.access(stubPath).then(() => true).catch(() => false);
      if (stubExists) {
        indexNorm.add(norm);
        continue;
      }
      const stub = `---\npillar: ${candidate.pillar}\ntitle: ${target}\ntier: 3\ncontent_ready: false\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags: [stub, auto-generated]\naliases: []\n---\n\n(Stub created by vault-nuggets embed because [[${candidate.title}]] referenced it. Fill in the body.)\n`;
      await fs.writeFile(stubPath, stub, "utf-8");
      stubsCreated.push({ pillar: candidate.pillar, target, path: stubPath });
      indexNorm.add(norm);
    }

    // Append to pillar Map of Content
    await appendToMoc(candidate.pillar, candidate.title).catch(() => undefined);
  }

  // Clean up: remove the staging dir for this task so the captain isn't confused later
  if (embedded.length > 0 || approved.length === staged.length) {
    await fs.rm(stagingDir(taskId), { recursive: true, force: true }).catch(() => undefined);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "summary.md"),
    `# Embed\n\nEmbedded ${embedded.length} note(s).\nCreated ${stubsCreated.length} stub(s) for missing wikilink targets.\nSkipped ${skipped.length}.\n`,
    "utf-8",
  );

  if (embedded.length > 0 || stubsCreated.length > 0) bustNotesCache();

  return { embedded, stubsCreated, skipped };
}

async function appendToMoc(pillar: string, title: string): Promise<void> {
  const moc = path.join(VAULT_ROOT, pillar, "Map of Content.md");
  const exists = await fs.access(moc).then(() => true).catch(() => false);
  if (!exists) return;
  const raw = await fs.readFile(moc, "utf-8");
  const line = `- [[${title}]]`;
  if (raw.includes(line)) return;
  // Append under the "## Notes" heading if present, otherwise at EOF
  const next = raw.includes("## Notes")
    ? raw.replace(/(##\s+Notes[^\n]*\n)/, `$1\n${line}\n`)
    : raw.trimEnd() + `\n\n${line}\n`;
  await fs.writeFile(moc, next, "utf-8");
}
