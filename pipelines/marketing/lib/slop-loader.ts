import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { registerSlopPack, type SlopRule } from "../../../core/lib/slop.ts";
import { SLOP_RULES_DIR } from "./paths.ts";

interface YamlRule {
  pattern: string;
  description?: string;
  severity?: "warn" | "fail";
}

interface YamlPack {
  banned_words?: YamlRule[];
  banned_patterns?: YamlRule[];
}

export const MARKETING_SLOP_PACK = "marketing";

function yamlToRule(group: string, idx: number, raw: YamlRule): SlopRule {
  const flags = raw.pattern.startsWith("(?i)") ? "i" : "";
  const pattern = raw.pattern.startsWith("(?i)") ? raw.pattern.slice(4) : raw.pattern;
  return {
    id: `${group}:${idx}`,
    pattern: new RegExp(pattern, flags),
    severity: raw.severity ?? "warn",
    message: raw.description,
  };
}

/** Load every YAML file under slop-rules/ and register them as a single pack. */
export async function loadMarketingSlopPack(): Promise<void> {
  const files = await fs.readdir(SLOP_RULES_DIR).catch(() => [] as string[]);
  const rules: SlopRule[] = [];
  for (const f of files) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const raw = await fs.readFile(path.join(SLOP_RULES_DIR, f), "utf-8");
    const parsed = yaml.load(raw) as YamlPack;
    (parsed.banned_words ?? []).forEach((r, i) => rules.push(yamlToRule(`banned_words:${f}`, i, r)));
    (parsed.banned_patterns ?? []).forEach((r, i) => rules.push(yamlToRule(`banned_patterns:${f}`, i, r)));
  }
  registerSlopPack(MARKETING_SLOP_PACK, rules);
}
