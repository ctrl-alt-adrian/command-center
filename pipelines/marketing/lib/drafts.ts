import fs from "fs/promises";
import path from "path";
import { DRAFTS_DIR } from "./paths.ts";
import type { Draft, DraftSet, DraftStatus } from "./types.ts";
import { readJson, writeJson, safeReaddir } from "../../../core/lib/io.ts";

async function readStatusFile(
  dateDir: string
): Promise<Record<string, DraftStatus>> {
  return readJson<Record<string, DraftStatus>>(path.join(dateDir, "status.json"), {});
}

async function writeStatusFile(
  dateDir: string,
  statuses: Record<string, DraftStatus>
): Promise<void> {
  await writeJson(path.join(dateDir, "status.json"), statuses);
}

export async function getDraftSets(): Promise<DraftSet[]> {
  const dirs = await safeReaddir(DRAFTS_DIR);

  const results = await Promise.all(
    dirs.map(async (dir) => {
      const dirPath = path.join(DRAFTS_DIR, dir);
      const stat = await fs.stat(dirPath).catch(() => null);
      if (!stat?.isDirectory()) return null;
      return buildDraftSet(dir, dirPath);
    })
  );

  return results
    .filter((s): s is DraftSet => s !== null)
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
}

export async function getDraftSet(date: string): Promise<DraftSet | null> {
  const dirPath = path.join(DRAFTS_DIR, date);
  const stat = await fs.stat(dirPath).catch(() => null);
  if (!stat?.isDirectory()) return null;

  return buildDraftSet(date, dirPath);
}

async function readMetaFile(
  dirPath: string
): Promise<{
  title?: string;
  date?: string;
  possibleDuplicateOf?: string;
  bodyDupSimilarity?: number;
}> {
  return readJson(path.join(dirPath, "meta.json"), {});
}

async function buildDraftSet(
  date: string,
  dirPath: string
): Promise<DraftSet | null> {
  const files = await fs.readdir(dirPath);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return null;

  const [statuses, meta] = await Promise.all([
    readStatusFile(dirPath),
    readMetaFile(dirPath),
  ]);
  const drafts = await Promise.all(
    mdFiles.map(async (file) => {
      const platform = path.basename(file, ".md");
      const content = await fs.readFile(path.join(dirPath, file), "utf-8");
      return { platform, content, status: statuses[platform] ?? "draft" } as Draft;
    })
  );
  const platforms: Record<string, Draft> = {};
  for (const d of drafts) platforms[d.platform] = d;

  return {
    date,
    title: meta.title,
    createdDate: meta.date,
    platforms,
    possibleDuplicateOf: meta.possibleDuplicateOf,
    bodyDupSimilarity: meta.bodyDupSimilarity,
  };
}

export async function saveDraft(
  date: string,
  platform: string,
  content: string
): Promise<void> {
  const dirPath = path.join(DRAFTS_DIR, date);
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(path.join(dirPath, `${platform}.md`), content, "utf-8");
}

export async function deleteDraftSet(date: string): Promise<void> {
  const dirPath = path.join(DRAFTS_DIR, date);
  await fs.rm(dirPath, { recursive: true, force: true });
}

/** Remove a single platform's draft (the .md file) and drop its status entry.
 *  Used by the slop-check exhaustion handler so failing drafts don't sit on
 *  disk as if they were publishable posts. The set itself is preserved when
 *  other platforms passed; only emptied-out sets get fully removed. */
export async function deleteDraftPlatform(date: string, platform: string): Promise<void> {
  const dirPath = path.join(DRAFTS_DIR, date);
  await fs.rm(path.join(dirPath, `${platform}.md`), { force: true });
  const statuses = await readStatusFile(dirPath);
  delete statuses[platform];
  await writeStatusFile(dirPath, statuses);
}

export async function updateDraftStatus(
  date: string,
  platform: string,
  status: DraftStatus
): Promise<void> {
  const dirPath = path.join(DRAFTS_DIR, date);
  const statuses = await readStatusFile(dirPath);
  statuses[platform] = status;
  await writeStatusFile(dirPath, statuses);
}
