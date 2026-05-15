import fs from "fs/promises";
import path from "path";
import { BRAND_DRAFTS_DIR } from "./paths.ts";
import { readJson } from "../../../core/lib/io.ts";

export interface BrandDraft {
  platform: string;
  content: string;
}

export interface BrandDraftSet {
  date: string;
  slug: string;
  title?: string;
  pillar?: string;
  tags?: string[];
  platforms: Record<string, BrandDraft>;
}

async function readMeta(dirPath: string): Promise<Partial<BrandDraftSet>> {
  return readJson<Partial<BrandDraftSet>>(path.join(dirPath, "meta.json"), {});
}

async function buildSet(slug: string, dirPath: string): Promise<BrandDraftSet | null> {
  const files = await fs.readdir(dirPath);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return null;

  const meta = await readMeta(dirPath);
  const platforms: Record<string, BrandDraft> = {};
  for (const file of mdFiles) {
    const platform = path.basename(file, ".md");
    const content = await fs.readFile(path.join(dirPath, file), "utf-8");
    platforms[platform] = { platform, content };
  }

  // Slug is `<date>_<rest>` — split to get a clean date field if meta is missing.
  const dateFromSlug = slug.slice(0, 10);
  return {
    slug,
    date: meta.date ?? dateFromSlug,
    title: meta.title,
    pillar: meta.pillar,
    tags: meta.tags,
    platforms,
  };
}

export async function getBrandDraftSets(): Promise<BrandDraftSet[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(BRAND_DRAFTS_DIR);
  } catch {
    return [];
  }
  const out: BrandDraftSet[] = [];
  for (const slug of entries) {
    const dirPath = path.join(BRAND_DRAFTS_DIR, slug);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const set = await buildSet(slug, dirPath);
    if (set) out.push(set);
  }
  // Newest first (slug starts with date).
  out.sort((a, b) => (a.slug < b.slug ? 1 : -1));
  return out;
}

export async function getBrandDraftSet(slug: string): Promise<BrandDraftSet | null> {
  const dirPath = path.join(BRAND_DRAFTS_DIR, slug);
  const stat = await fs.stat(dirPath).catch(() => null);
  if (!stat?.isDirectory()) return null;
  return buildSet(slug, dirPath);
}

export async function saveBrandDraft(slug: string, platform: string, content: string): Promise<void> {
  const dirPath = path.join(BRAND_DRAFTS_DIR, slug);
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(path.join(dirPath, `${platform}.md`), content, "utf-8");
}
