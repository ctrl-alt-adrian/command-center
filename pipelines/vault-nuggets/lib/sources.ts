import fs from "fs/promises";
import path from "path";
import { LEGACY_SESSIONS_ROOT, VAULT_ROOT } from "../../../core/lib/paths.ts";

export interface NuggetSource {
  kind: "legacy-session" | "build-journal";
  id: string;
  path: string;
  modifiedAt: number; // ms epoch
  raw: string;
}

async function walkMarkdown(dir: string, kind: NuggetSource["kind"]): Promise<NuggetSource[]> {
  const out: NuggetSource[] = [];
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".")) continue;
      out.push(...(await walkMarkdown(p, kind)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const stat = await fs.stat(p).catch(() => null);
      if (!stat) continue;
      const raw = await fs.readFile(p, "utf-8").catch(() => "");
      if (!raw.trim()) continue;
      out.push({
        kind,
        id: path.basename(e.name, ".md"),
        path: p,
        modifiedAt: stat.mtimeMs,
        raw,
      });
    }
  }
  return out;
}

export async function listLegacySessionSources(since: number): Promise<NuggetSource[]> {
  const all = await walkMarkdown(LEGACY_SESSIONS_ROOT, "legacy-session");
  return all.filter((s) => s.modifiedAt > since);
}

export async function listBuildJournalSources(since: number): Promise<NuggetSource[]> {
  const buildJournal = path.join(VAULT_ROOT, "build-journal");
  const all = await walkMarkdown(buildJournal, "build-journal");
  // Skip Map of Content; it's an index.
  return all.filter((s) => s.modifiedAt > since && s.id.toLowerCase() !== "map of content");
}
