import fs from "fs/promises";
import path from "path";
import { KB_DIR } from "./paths.ts";
import type { KBEntry } from "./types.ts";
import { safeReaddir } from "./files.ts";

function parseFrontmatter(raw: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const parts = raw.split("---");
  if (parts.length < 3) {
    return { meta: {}, body: raw };
  }

  const frontmatterBlock = parts[1].trim();
  const body = parts.slice(2).join("---").trim();
  const meta: Record<string, unknown> = {};

  for (const line of frontmatterBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      // Parse inline array: [item1, item2]
      const inner = value.slice(1, -1);
      meta[key] = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (value === "true") {
      meta[key] = true;
    } else if (value === "false") {
      meta[key] = false;
    } else {
      meta[key] = value;
    }
  }

  return { meta, body };
}

function toKBEntry(filename: string, raw: string): KBEntry {
  const { meta, body } = parseFrontmatter(raw);
  const stem = path.basename(filename, path.extname(filename));

  // Normalize both field name variants
  const usedForContent =
    (meta.usedForContent as boolean) ??
    (meta.used_for_content as boolean) ??
    false;

  return {
    id: stem,
    filename,
    date: (meta.date as string) ?? "",
    project: (meta.project as string) ?? "",
    summary: (meta.summary as string) ?? "",
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    contentAngles: Array.isArray(meta.contentAngles)
      ? (meta.contentAngles as string[])
      : [],
    shareworthy: (meta.shareworthy as boolean) ?? false,
    usedForContent,
    body,
    contentWorthy: meta.contentWorthy as boolean | undefined,
    contentType: meta.contentType as "technical" | "marketing" | undefined,
    hook: (meta.hook as string) || undefined,
    angle: (meta.angle as string) || undefined,
    analyzedAt: (meta.analyzedAt as string) || undefined,
  };
}

export async function getKBEntries(): Promise<KBEntry[]> {
  const files = await safeReaddir(KB_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const entries = await Promise.all(
    mdFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(KB_DIR, file), "utf-8");
      return toKBEntry(file, raw);
    })
  );

  entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return entries;
}

export async function getKBEntry(id: string): Promise<KBEntry | null> {
  const entries = await getKBEntries();
  return entries.find((e) => e.id === id) ?? null;
}

export async function markUsedForContent(id: string): Promise<void> {
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
