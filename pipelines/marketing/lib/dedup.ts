import fs from "fs/promises";
import path from "path";
import { DRAFTS_DIR } from "./paths.ts";
import { readJson, safeReaddir } from "./files.ts";
import {
  BODY_DUPLICATE_THRESHOLD,
  META_DUPLICATE_THRESHOLD,
  PLATFORMS,
} from "./constants.ts";
import type { ContentCandidate } from "./generate.ts";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "about", "between",
  "through", "after", "before", "above", "below", "and", "but", "or",
  "not", "no", "so", "if", "then", "than", "that", "this", "it", "its",
  "my", "your", "our", "their", "we", "you", "they", "i", "me", "he",
  "she", "him", "her", "us", "them", "what", "which", "who", "how",
  "when", "where", "why", "all", "each", "every", "both", "few", "more",
  "most", "some", "any", "such", "just", "also", "very", "too",
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface PastDraftMeta {
  slug: string;
  keywords: Set<string>;
}

function metaTextFromJson(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta.title === "string") parts.push(meta.title);
  if (typeof meta.angle === "string") parts.push(meta.angle);
  if (typeof meta.insight === "string") parts.push(meta.insight);
  if (typeof meta.painPoint === "string") parts.push(meta.painPoint);
  if (Array.isArray(meta.tags)) parts.push(meta.tags.filter((t) => typeof t === "string").join(" "));
  return parts.join(" ");
}

function metaTextFromSlug(slug: string): string {
  return slug
    .replace(/^\d{4}-\d{2}-\d{2}_/, "")
    .replace(/-[a-z0-9]{4}$/, "")
    .replace(/-/g, " ");
}

async function readDraftSlugs(): Promise<string[]> {
  const entries = await safeReaddir(DRAFTS_DIR);
  return entries.filter((e) => /^\d{4}-\d{2}-\d{2}_/.test(e));
}

async function getPastDraftMetas(): Promise<PastDraftMeta[]> {
  const slugs = await readDraftSlugs();
  const metas = await Promise.all(
    slugs.map(async (slug) => {
      const parsed = await readJson<Record<string, unknown>>(path.join(DRAFTS_DIR, slug, "meta.json"), {});
      const metaText = metaTextFromJson(parsed) || metaTextFromSlug(slug);
      return { slug, keywords: extractKeywords(metaText) };
    })
  );
  return metas.filter((m) => m.keywords.size > 0);
}

export interface DedupResult {
  candidate: ContentCandidate;
  isDuplicate: boolean;
  duplicateOf?: string;
  similarity: number;
}

function candidateKeywords(candidate: ContentCandidate): Set<string> {
  return extractKeywords(
    `${candidate.hook} ${candidate.angle} ${candidate.tags.join(" ")} ${candidate.type}`
  );
}

export async function checkDuplicates(
  candidates: ContentCandidate[]
): Promise<DedupResult[]> {
  const pastMetas = await getPastDraftMetas();

  return candidates.map((candidate) => {
    const kw = candidateKeywords(candidate);
    let maxSimilarity = 0;
    let duplicateOf: string | undefined;

    for (const past of pastMetas) {
      const score = jaccard(kw, past.keywords);
      if (score > maxSimilarity) {
        maxSimilarity = score;
        duplicateOf = past.slug;
      }
    }

    const isDuplicate = maxSimilarity >= META_DUPLICATE_THRESHOLD;
    return {
      candidate,
      isDuplicate,
      duplicateOf: isDuplicate ? duplicateOf : undefined,
      similarity: Math.round(maxSimilarity * 100) / 100,
    };
  });
}

// --- Body-level dedup (post-generation) ---

export interface BodyDupMatch {
  slug: string;
  similarity: number;
  platform: string;
}

async function readBodyKeywords(
  slug: string
): Promise<Record<string, Set<string>>> {
  const dir = path.join(DRAFTS_DIR, slug);
  const entries = await Promise.all(
    PLATFORMS.map(async (platform) => {
      try {
        const content = await fs.readFile(path.join(dir, `${platform}.md`), "utf-8");
        return [platform, extractKeywords(content)] as const;
      } catch {
        return [platform, new Set<string>()] as const;
      }
    })
  );
  const result: Record<string, Set<string>> = {};
  for (const [platform, kw] of entries) {
    if (kw.size > 0) result[platform] = kw;
  }
  return result;
}

/**
 * Compare a freshly generated draft set's bodies against every past draft.
 * Returns the closest match (by max per-platform Jaccard) if it clears the threshold.
 */
export async function checkBodyDuplicate(
  newSlug: string,
  newBodies: Record<string, string>
): Promise<BodyDupMatch | null> {
  const slugs = (await readDraftSlugs()).filter((s) => s !== newSlug);
  if (slugs.length === 0) return null;

  const newKeywords: Record<string, Set<string>> = {};
  for (const [platform, content] of Object.entries(newBodies)) {
    const kw = extractKeywords(content);
    if (kw.size > 0) newKeywords[platform] = kw;
  }
  if (Object.keys(newKeywords).length === 0) return null;

  let best: BodyDupMatch | null = null;

  for (const slug of slugs) {
    const past = await readBodyKeywords(slug);
    for (const [platform, newKw] of Object.entries(newKeywords)) {
      const pastKw = past[platform];
      if (!pastKw) continue;
      const score = jaccard(newKw, pastKw);
      if (!best || score > best.similarity) {
        best = { slug, similarity: Math.round(score * 100) / 100, platform };
      }
    }
  }

  if (!best || best.similarity < BODY_DUPLICATE_THRESHOLD) return null;
  return best;
}
