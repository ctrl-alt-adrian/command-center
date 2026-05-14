import fs from "fs/promises";
import path from "path";
import { json, error } from "@sveltejs/kit";
import { claude } from "../../../../../../../../../core/lib/claude.ts";
import { CLI_DIR } from "../../../../../../../../../pipelines/personal-brand/lib/paths.ts";

let cachedPrompt: string | null = null;
async function loadRefinePrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  cachedPrompt = await fs.readFile(path.join(CLI_DIR, "refine-post.md"), "utf-8");
  return cachedPrompt;
}

export async function POST({ params, request }) {
  const body = (await request.json().catch(() => ({}))) as {
    content?: unknown;
    instruction?: unknown;
  };
  if (typeof body.content !== "string" || !body.content) {
    throw error(400, "content (string) required");
  }
  if (typeof body.instruction !== "string" || !body.instruction.trim()) {
    throw error(400, "instruction (non-empty string) required");
  }

  const template = await loadRefinePrompt();
  const refinePrompt = template.replaceAll("{{platform}}", params.platform!);
  const prompt = `${refinePrompt}

## Current draft
---
${body.content}
---

## User instruction
${body.instruction.trim()}

Apply the instruction and output ONLY the revised post content.`;

  const refined = await claude(prompt, { model: "claude-sonnet-4-6", timeoutMs: 5 * 60 * 1000 });
  return json({ content: refined });
}
