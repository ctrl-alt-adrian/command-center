import fs from "fs/promises";
import path from "path";
import { claude } from "../../../core/lib/claude.ts";
import { BRAND_DRAFTS_DIR, CLI_DIR } from "./paths.ts";

const SONNET = "claude-sonnet-4-6";
const SHORT_FORM_HAIKU = "claude-haiku-4-5-20251001";
const SHORT_FORM_PLATFORMS = new Set(["x"]); // Twitter posts are short — haiku is sufficient
const SLUG_MAX_LENGTH = 64;

export const BRAND_PLATFORMS = ["linkedin", "x", "instagram", "facebook", "reddit", "blog"] as const;
export type BrandPlatform = (typeof BRAND_PLATFORMS)[number];

export interface BrandGenerateInput {
  title: string;
  pillar: string;
  body: string;
  tags: string[];
}

export interface BrandGenerateResult {
  date: string;
  slug: string;
  draftDir: string;
  platforms: Record<string, { content: string } | { error: string }>;
}

let cachedWritePrompt: string | null = null;
async function loadWritePrompt(): Promise<string> {
  if (cachedWritePrompt) return cachedWritePrompt;
  cachedWritePrompt = await fs.readFile(path.join(CLI_DIR, "write-post.md"), "utf-8");
  return cachedWritePrompt;
}

function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-$/, "");
}

export async function generateBrandDrafts(
  input: BrandGenerateInput,
): Promise<BrandGenerateResult> {
  const today = new Date().toISOString().slice(0, 10);
  const uid = Date.now().toString(36).slice(-4);
  const slug = `${today}_${buildSlug(input.title)}-${uid}`;
  const draftDir = path.join(BRAND_DRAFTS_DIR, slug);
  await fs.mkdir(draftDir, { recursive: true });

  // Persist meta.json so the drafts list view can render context without re-parsing each platform file.
  await fs.writeFile(
    path.join(draftDir, "meta.json"),
    JSON.stringify(
      {
        date: today,
        title: input.title,
        pillar: input.pillar,
        tags: input.tags,
        source: { kind: "vault-note", title: input.title, pillar: input.pillar },
      },
      null,
      2,
    ),
    "utf-8",
  );

  const writePromptTemplate = await loadWritePrompt();

  // Generate all platforms in parallel; settled so one failure doesn't kill the rest.
  const settled = await Promise.allSettled(
    BRAND_PLATFORMS.map(async (platform) => {
      const platformPrompt = writePromptTemplate.replaceAll("{{platform}}", platform);
      const prompt = `${platformPrompt}

## Source vault note

Title: ${input.title}
Pillar: ${input.pillar}
${input.tags.length > 0 ? `Tags: ${input.tags.join(", ")}\n` : ""}
---
${input.body}
---

Write the ${platform} post now.`;
      const model = SHORT_FORM_PLATFORMS.has(platform) ? SHORT_FORM_HAIKU : SONNET;
      const content = await claude(prompt, { model, timeoutMs: 5 * 60 * 1000 });
      await fs.writeFile(path.join(draftDir, `${platform}.md`), content, "utf-8");
      return [platform, content] as const;
    }),
  );

  const platforms: BrandGenerateResult["platforms"] = {};
  for (let i = 0; i < settled.length; i++) {
    const platform = BRAND_PLATFORMS[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      platforms[platform] = { content: result.value[1] };
    } else {
      platforms[platform] = { error: (result.reason as Error).message };
    }
  }

  return { date: today, slug, draftDir, platforms };
}
