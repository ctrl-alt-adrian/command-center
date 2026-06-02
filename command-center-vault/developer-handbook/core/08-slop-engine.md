# Core 08 — The Slop Engine (`core/lib/slop.ts`)

The slop engine is a tiny, domain-agnostic **regex linter**. Pipelines register named "packs" of rules; a deterministic gate can then run a pack against generated text and fail the gate if any `fail`-severity rule matches. Core ships **zero rules** — the engine is pure mechanism. The marketing and reddit-pmf pipelines supply the rules.

> Prereqs: [04-gates.md](04-gates.md) (how a deterministic gate's `check()` consumes a result). [01-data-model.md](01-data-model.md) (`GateCheckResult`).

---

## Types

```ts
// core/lib/slop.ts:4-24
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
```

- **`SlopSeverity`** — `"warn"` or `"fail"`. Only `fail` affects `pass`; `warn` is advisory (shown but doesn't block).
- **`SlopRule`** — a rule: a stable `id`, a `RegExp` `pattern`, a `severity`, and an optional human `message`.
- **`SlopViolation`** — a match: which rule (`ruleId`), the `severity`, the **1-based** `line`, the trimmed line `excerpt`, and the rule's `message`.
- **`SlopResult`** — `pass` (no `fail`-severity violation) plus the full `violations` list (including warns).

Note `SlopResult` is **not** `GateCheckResult`. A pipeline's `check()` converts one to the other — typically `{ pass: result.pass, reason: <summary of fail violations> }`.

---

## The pack registry

```ts
// core/lib/slop.ts:26-34
const packs = new Map<string, SlopRule[]>();

export function registerSlopPack(packId: string, rules: SlopRule[]): void {
  packs.set(packId, rules);
}

export function getSlopPack(packId: string): SlopRule[] | undefined {
  return packs.get(packId);
}
```

A module-level `Map<string, SlopRule[]>` keyed by pack id, mirroring the [pipeline registry](07-registry-bootstrap.md)'s pattern. `registerSlopPack` is overwrite-idempotent (`Map.set`). `getSlopPack` returns the rules or `undefined`.

Pipelines register their packs at module load (the bootstrap comment in the file notes: *"phase 2 loads marketing rules from YAML, phase 5 loads reddit-voice rules"*). Core itself registers nothing.

---

## `runRules` — the engine

```ts
// core/lib/slop.ts:36-59
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
```

Mechanics:

1. **Lookup the pack.** Unknown pack → **throws** (`Unknown slop pack: ...`). This propagates out of the gate's `check()` and becomes an `error`-outcome attempt on the task (a config bug — register the pack first).
2. **Split on `\n`** and test each rule against **each line independently**. So patterns match *within a line*, not across line boundaries. A rule needing multi-line context won't work here.
3. **Line numbers are 1-based** (`i + 1`). The `excerpt` is the **trimmed** line.
4. **`pass`** is `true` iff **no** violation has `severity === "fail"`. Any number of `warn` violations still passes.

> **Goodbye note — per-line matching.** Because each rule is `rule.pattern.test(line)` over single lines, regex flags like `m` (multiline) or `s` (dotall) buy you nothing across lines — the input is already one line at a time. Also, `test()` advances `lastIndex` on **global (`/g`) regexes**, which can cause a `/g` pattern to skip matches on alternating calls. **Prefer non-global patterns in slop rules.** If a pack uses `/g`, results may be subtly wrong; this is a sharp edge of `RegExp.test` (see the [MDN/TypeScript RegExp docs](https://www.typescriptlang.org/docs/)). One match per rule per line is recorded regardless (the inner loop pushes at most once per `test` call).

---

## Test helper

```ts
// core/lib/slop.ts:61-64
// Test helper.
export function _resetSlop(): void {
  packs.clear();
}
```

Clears all packs. Tests only.

---

## How pipelines wire it into a gate

The pattern (in marketing and reddit-pmf): a phase's deterministic-gate `check()` reads the generated text (from the prior phase's output / a draft file), calls `runRules(text, "<packId>")`, and maps the `SlopResult` to a `GateCheckResult`:

```ts
// illustrative — the shape a pipeline's check() takes (see the actual pipeline configs)
async check(task) {
  const text = /* read the drafted artifact */;
  const result = runRules(text, "marketing");
  if (result.pass) return { pass: true };
  const fails = result.violations.filter((v) => v.severity === "fail");
  return {
    pass: false,
    reason: fails.map((v) => `L${v.line} ${v.ruleId}: ${v.excerpt}`).join("; "),
  };
}
```

That `reason` is what flows back upstream as `gateRetryFeedback` on a rewind (see [04-gates.md](04-gates.md)) — so the slop complaint literally becomes the regeneration instruction. The `warn`-severity violations are visible in the result but don't trip the gate.

The two consumers:

- **marketing** — slop pack for marketing copy voice/quality. See [`../pipelines/marketing.md`](../pipelines/marketing.md).
- **reddit-pmf** — a "reddit-voice" slop pack. See [`../pipelines/reddit-pmf.md`](../pipelines/reddit-pmf.md).

> Exact pack ids, rule lists, and where the text is read from live in those pipeline configs, not in core. Core only guarantees the engine behavior documented above.

---

## Why it lives in core (and stays rule-free)

Slop-checking is a *mechanism* (run regexes over lines, decide pass/fail) that multiple domains want, with *different* rules. Putting the mechanism in core and the rules in pipelines keeps core domain-agnostic — same firewall principle as the [registry](07-registry-bootstrap.md). If you add a new pipeline that needs slop-checking, you `registerSlopPack("<yourpack>", rules)` from your pipeline and call `runRules(text, "<yourpack>")` in your gate. You never touch `slop.ts`.

---

## Where to go next

- [04-gates.md](04-gates.md) — the deterministic gate that consumes `runRules` and feeds its reason upstream.
- [`../pipelines/marketing.md`](../pipelines/marketing.md), [`../pipelines/reddit-pmf.md`](../pipelines/reddit-pmf.md) — the two pipelines that register and run slop packs.
- [07-registry-bootstrap.md](07-registry-bootstrap.md) — the same register-by-id pattern for pipelines.
