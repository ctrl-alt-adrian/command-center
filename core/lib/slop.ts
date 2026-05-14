// Domain-agnostic slop rule engine. Pipelines register their own rule packs.
// Core does not ship any rules; phase 2 loads marketing rules from YAML, phase 5 loads reddit-voice rules.

export type SlopSeverity = "warn" | "fail";

export interface SlopRule {
  id: string;
  pattern: RegExp;
  severity: SlopSeverity;
  message?: string;
}

export interface SlopViolation {
  ruleId: string;
  severity: SlopSeverity;
  line: number;
  excerpt: string;
  message?: string;
}

export interface SlopResult {
  pass: boolean;
  violations: SlopViolation[];
}

const packs = new Map<string, SlopRule[]>();

export function registerSlopPack(packId: string, rules: SlopRule[]): void {
  packs.set(packId, rules);
}

export function getSlopPack(packId: string): SlopRule[] | undefined {
  return packs.get(packId);
}

export function runRules(text: string, packId: string): SlopResult {
  const rules = packs.get(packId);
  if (!rules) {
    throw new Error(`Unknown slop pack: ${packId}. Register it before running.`);
  }
  const violations: SlopViolation[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          line: i + 1,
          excerpt: line.trim(),
          message: rule.message,
        });
      }
    }
  }
  const pass = !violations.some((v) => v.severity === "fail");
  return { pass, violations };
}

// Test helper.
export function _resetSlop(): void {
  packs.clear();
}
