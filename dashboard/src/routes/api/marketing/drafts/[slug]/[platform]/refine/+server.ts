import { json, error } from "@sveltejs/kit";
import { claude } from "../../../../../../../../../core/lib/claude.ts";

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

  const prompt = `You are editing a ${params.platform} social media post for Adrian, founder of rolenext (an interview prep platform).

Here is the current draft:
---
${body.content}
---

The user wants the following change:
${body.instruction.trim()}

Apply the requested change. Output ONLY the revised post content. No commentary, no labels, no markdown code blocks. Keep the same general structure unless the instruction specifically asks to change it.`;

  const refined = await claude(prompt, { model: "claude-sonnet-4-6", timeoutMs: 5 * 60 * 1000 });
  return json({ content: refined });
}
