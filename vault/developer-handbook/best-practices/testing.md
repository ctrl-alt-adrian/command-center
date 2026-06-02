# Best Practices — Testing

Honest version: this codebase has **almost no automated tests**. There is no test framework, no `test` npm script, and exactly one unit-test file. That is not an oversight to apologize for — it's the reality you inherit, and this page documents the verification workflow that actually keeps the system correct, plus how to extend testing if you choose to.

Related reading:

- [coding conventions](coding.md) · [implementing-features](implementing-features.md) · [testing ← you are here]
- [Getting started](../03-getting-started.md) · [Troubleshooting](../operations/troubleshooting.md) · [slop engine](../core/08-slop-engine.md)

---

## 1. The primary gate is `npm run check`

There is **no `test` script** in `package.json` or `dashboard/package.json` (verified — neither file defines one). The single verification gate before you consider anything done is:

```bash
npm run check         # repo root → cd dashboard && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
```

This runs `svelte-kit sync` (regenerates SvelteKit's generated types) then `svelte-check` (TypeScript + Svelte type-checking) across the dashboard *and every core/pipeline module it imports* — roughly 407 files, target **0 errors / 0 warnings** (`HANDOFF.md:50`, `OPTIMIZATION_HANDOFF.md:97-103`). Because the whole repo is strict TypeScript ESM with explicit `.ts` imports, the type checker catches the majority of real mistakes: wrong `PhaseConfig` shape, a `check()` that doesn't return `{ pass }`, a renamed field, a bad import path.

**Treat a clean `npm run check` as the minimum bar, not proof of correctness.** It proves the types line up; it does not prove a phase produces the right output or a gate rewinds correctly. For that, use the manual loop (§4).

---

## 2. The one unit test, and how to run it

There is exactly one test file: `pipelines/rolenext/bug-resolver/lib/dedup.test.ts`. It uses Node's built-in `node:assert/strict` with a **hand-rolled** `test()` / `passed` / `failed` harness — no vitest, no jest, no `node:test` runner.

Its real structure (`pipelines/rolenext/bug-resolver/lib/dedup.test.ts:1-84`):

```ts
import assert from "node:assert/strict";
import { computeFingerprint, extractPageUrl } from "./dedup.ts";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn();
    if (r instanceof Promise) {
      r.then(() => { console.log(`  ✓ ${name}`); passed++; },
             (err) => { console.error(`  ✗ ${name}\n    ${(err as Error).message}`); failed++; });
    } else { console.log(`  ✓ ${name}`); passed++; }
  } catch (err) { console.error(`  ✗ ${name}\n    ${(err as Error).message}`); failed++; }
}

test("URL query and trailing slash dropped", () => {
  const a = computeFingerprint("https://example.com/tracker/?utm=foo", "Bug body here");
  const b = computeFingerprint("https://EXAMPLE.com/tracker", "Bug body here");
  assert.equal(a, b);
});
// …more test() calls…

setImmediate(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
```

**How to run it** (verified working on this machine, Node v25.9.0):

```bash
node --experimental-strip-types pipelines/rolenext/bug-resolver/lib/dedup.test.ts
# → 8 passed, 0 failed   (exit 0)
```

`--experimental-strip-types` lets Node execute the `.ts` file directly (the harness `import`s `./dedup.ts`, so plain JS execution wouldn't resolve types). `npx tsx pipelines/rolenext/bug-resolver/lib/dedup.test.ts` also works if you prefer tsx. **The runner is not wired into `package.json`** — there is no `npm test`; you invoke the file directly. The `setImmediate` block prints the tally and sets a non-zero exit code on failure, which is what makes it usable from a future CI line even without a framework.

---

## 3. Test-only reset helpers exist in core

Two global registries in core are module-level singletons. They expose reset helpers *specifically* so tests can run cases in isolation without state leaking between them:

- `_resetRegistry()` — clears the pipeline registry (`core/lib/registry.ts:48-51`, commented *"Test helper. Production code should not call this."*).
- `_resetSlop()` — clears registered slop packs (`core/lib/slop.ts:61-64`).

If you write a test that registers a pipeline or a slop pack, call the matching reset in teardown so the next case starts clean:

```ts
import { _resetRegistry, registerPipeline } from "../../core/lib/registry.ts";
import { _resetSlop, registerSlopPack, runRules } from "../../core/lib/slop.ts";

// before each case:
_resetRegistry();
_resetSlop();
```

Their existence is the codebase signaling that these globals are the seam where tests plug in.

---

## 4. Manual / integration validation is the real workflow

This is how the pipelines were actually validated (competitors end-to-end via yt-dlp, software-factory-housekeeping, etc. — `HANDOFF.md:24-32`). It is the practical "test suite". Loop:

```bash
# 1. Start the dashboard (port 3001)
cd dashboard && npm run dev

# 2. Create a task by POSTing the pipeline id
curl -s -X POST http://localhost:3001/api/tasks \
  -H 'content-type: application/json' \
  -d '{"pipelineId":"my-pipeline"}'        # → { "task": { "id": "…" } }

# 3. Watch it on the dashboard
#    open http://localhost:3001/tasks

# 4. Advance one processor tick manually (instead of waiting for cron)
curl -s -X POST http://localhost:3001/api/cron   # runs runProcessor() once

# 5. Inspect the on-disk truth
cat tasks/<id>/task.json                    # status, attempts[], input, output
ls  tasks/<id>/                             # one dir per phase that ran
cat logs/processor-$(date +%F).log          # phase_start / advanced / gate_rewind / failed events
cat logs/processor-state.json               # last tick's processed/deferred/paused counts
```

Each `POST /api/cron` runs the processor exactly once (`runProcessor()` — `core/lib/processor.ts:57`), so you can step a task phase-by-phase and confirm each transition. The `attempts[]` array in `task.json` is your audit trail: `ok` / `gate_fail` / `error` outcomes with reasons (`types.ts:83-89`). For deterministic-gate work, plant a failing input and watch the log emit `gate_rewind` → upstream re-run → `advanced` (the marketing slop loop — `processor.ts:259-282`). To test fan-out and batching, approve a discovery task and confirm only `fanOutBatchSize` children go `pending` while the rest sit `paused_user`.

This loop validates *behavior* — exactly what `npm run check` cannot. Run both before calling a feature done. See [getting started](../03-getting-started.md) for first-run setup and [troubleshooting](../operations/troubleshooting.md) when a task wedges.

---

## 5. GOOD / BAD — write testable code by extracting pure helpers

**WHY this matters:** the one thing that *is* unit-tested (`dedup.ts`) is testable precisely because it's a pure function — string in, fingerprint out, no IO, no claude, no clock. The pattern across the repo is `pipeline.config.ts` (the wiring) importing from `pipelines/<name>/lib/*.ts` (the logic). Keep the testable logic in `lib/`.

**BAD** — logic buried inside a phase `run()` that shells out to claude and writes files. Untestable without a live `claude` binary, a filesystem, and the whole processor:

```ts
// ❌ everything tangled inside run(): IO + claude + the actual rule you care about
run: async (task, ctx) => {
  const text = await fs.readFile(task.input.draftDir + "/x.md", "utf-8");
  const score = text.split(" ").filter(w => BANNED.has(w)).length;   // ← the logic you'd want to test
  const verdict = await claude("rate this: " + text);                 // ← needs the CLI
  await fs.writeFile(/* … */);                                        // ← needs the FS
  return { output: { score, verdict } };
}
```

**GOOD** — pure logic in `lib/`, `run()` is thin glue. The pure part gets a `node:assert` test; the glue gets the manual loop (§4):

```ts
// pipelines/my-pipeline/lib/score.ts — PURE: trivially unit-testable
export function slopScore(text: string, banned: Set<string>): number {
  return text.split(/\s+/).filter((w) => banned.has(w.toLowerCase())).length;
}
```

```ts
// pipeline.config.ts run() — thin glue around the pure helper
run: async (task, ctx) => {
  const text = await readPhaseInput(task);          // IO at the edge
  const score = slopScore(text, BANNED);            // pure call — already tested
  return { output: { score } };
}
```

```ts
// pipelines/my-pipeline/lib/score.test.ts — same hand-rolled harness as dedup.test.ts
import assert from "node:assert/strict";
import { slopScore } from "./score.ts";
test("counts banned words case-insensitively", () => {
  assert.equal(slopScore("Truly Game-changing stuff", new Set(["game-changing"])), 1);
});
```

**Highest-value pure modules to cover** (all already separated from their pipeline config):

- `pipelines/rolenext/bug-resolver/lib/dedup.ts` — fingerprinting (already covered).
- `core/lib/slop.ts` `runRules()` — regex rule evaluation (use `_resetSlop()` + `registerSlopPack()` in setup).
- Any `lib/*.ts` doing scoring / jaccard similarity / dedup / normalization — string-and-data in, value out.
- `core/lib/registry.ts` `nextPhase`/`previousPhase`/`isFirstPhase` — pure index math, easy wins.

---

## 6. Recommendation (not current fact) — if you expand testing

This is a *suggestion*, not something the repo does today. If automated tests start earning their keep:

1. **Wire a `test` script + a runner.** Either standardize on Node's built-in `node:test` runner (`node --test --experimental-strip-types`), or add a tiny script that runs every `*.test.ts` through the existing hand-rolled-harness convention. Add `"test": "..."` to root `package.json` and call it in any future CI alongside `npm run check`.
2. **Start with the pure modules in §5** — they're zero-friction and cover the riskiest logic (dedup, slop rules, scoring).
3. **Don't try to unit-test `run()`/`check()` that shell out to `claude`.** Those belong to the manual loop (§4). If a phase has logic worth testing, extract it to `lib/` first (§5) — that refactor is the test improvement.
4. **Keep `_resetRegistry()` / `_resetSlop()` honored** in setup/teardown so cases stay isolated.

Until then: `npm run check` + the manual `/api/cron` loop is the verification workflow. Run both, every time.
