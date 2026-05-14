import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { registerSlopPack, type SlopRule } from "../../../core/lib/slop.ts";

const SLOP_DIR = path.resolve(import.meta.dirname, "..", "slop-rules");

interface YamlRule {
  pattern: string;
  description?: string;
  severity?: "warn" | "fail";
}
interface YamlPack {
  banned_words?: YamlRule[];
  banned_patterns?: YamlRule[];
}

export const REDDIT_SLOP_PACK = "reddit-voice";

function yamlToRule(group: string, idx: number, raw: YamlRule): SlopRule {
  const flags = raw.pattern.startsWith("(?i)") ? "i" : "";
  const pattern = raw.pattern.startsWith("(?i)") ? raw.pattern.slice(4) : raw.pattern;
  return {
    id: `${group}:${idx}`,
    pattern: new RegExp(pattern, flags),
    severity: raw.severity ?? "fail",
    message: raw.description,
  };
}

export async function loadRedditSlopPack(): Promise<void> {
  const files = await fs.readdir(SLOP_DIR).catch(() => [] as string[]);
  const rules: SlopRule[] = [];
  for (const f of files) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const raw = await fs.readFile(path.join(SLOP_DIR, f), "utf-8");
    const parsed = yaml.load(raw) as YamlPack;
    (parsed.banned_words ?? []).forEach((r, i) => rules.push(yamlToRule(`banned_words:${f}`, i, r)));
    (parsed.banned_patterns ?? []).forEach((r, i) => rules.push(yamlToRule(`banned_patterns:${f}`, i, r)));
  }
  registerSlopPack(REDDIT_SLOP_PACK, rules);
}
