# Core 04 — Gates (`applyGate` in `core/lib/processor.ts`)

A **gate** decides what happens after a phase's `run()` finishes. There are exactly three gate types ([`GateType`](01-data-model.md)), and all of them are handled by one function, `applyGate`. The interesting one is `deterministic`, which carries the system's most subtle design: a **retry budget that survives a round-trip through other phases** and a **rewind** that feeds the failure reason back upstream so the artifact gets *regenerated*, not just re-checked.

> Prereqs: [01-data-model.md](01-data-model.md) (`GateCheckResult`, `RetryPolicy`, the two retry counters), [03-processor.md](03-processor.md) (`runPhase` calls `applyGate`).

---

## The signature

```ts
// core/lib/processor.ts:214
async function applyGate(pipeline: PipelineConfig, phase: PhaseConfig, task: Task, startedAt: string): Promise<void>
```

`startedAt` is captured in `runPhase` so every attempt record has an accurate start time. `applyGate` always appends exactly one `TaskAttempt` per invocation.

---

## Gate type 1 — `needs_review` (park for the captain)

```ts
// core/lib/processor.ts:215-221
if (phase.gateType === "needs_review") {
  await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
  await updateTask(task.id, { status: "needs_review" });
  ...
  return;
}
```

The phase succeeded; now a human must approve. The attempt is recorded `ok` (the phase *did* its job — review is a separate step, not a failure). The task sits in `needs_review` until [`approveTask`/`rejectTask`](03-processor.md) is called.

---

## Gate type 2 — `auto_pass` (advance immediately)

```ts
// core/lib/processor.ts:223-227
if (phase.gateType === "auto_pass") {
  await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
  await advanceOrComplete(pipeline, phase, task);
  return;
}
```

No human, no check. Append `ok`, advance. Used for phases whose output never needs gating (e.g. a pure transform, or the phase a rewind lands on so it auto-flows back forward).

---

## Gate type 3 — `deterministic` (run `check()`)

### Missing-check guard

```ts
// core/lib/processor.ts:229-233
// deterministic
if (!phase.check) {
  await fail(task, `phase ${phase.id} has gate deterministic but no check function`);
  return;
}
```

A `deterministic` gate with no `check` function is a configuration bug — the task is failed loudly.

### Pass path

```ts
// core/lib/processor.ts:234-239
const result = await phase.check(task);
if (result.pass) {
  await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
  await advanceOrComplete(pipeline, phase, task);
  return;
}
```

`check()` returns a [`GateCheckResult`](01-data-model.md). Pass → `ok` attempt → advance.

### Fail path — compute the budget

```ts
// core/lib/processor.ts:241-257
// Gate failed. Retry policy.
// We budget retries via `input.gateRetryCount` because the rewind path
// sends the task back to the previous phase and then forward through a
// freshly-created next-phase task — so a single task's `retryCount`
// wouldn't accumulate across the cycle. Carrying the counter in input
// means the budget survives the round-trip.
const max = phase.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_MAX;
const fresh = await getTask(task.id);
const gateRetryCount = (fresh?.input?.gateRetryCount as number | undefined) ?? 0;
const nextGateRetryCount = gateRetryCount + 1;
await appendAttempt(task.id, {
  phaseId: phase.id,
  startedAt,
  finishedAt: nowIso(),
  outcome: "gate_fail",
  reason: result.reason,
});
```

`max` is the budget (`retryPolicy.maxAttempts` or `DEFAULT_RETRY_MAX` = 3). The current count is read from **`input.gateRetryCount`** (re-read fresh from disk to avoid a stale in-memory value), incremented, and compared. A `gate_fail` attempt with the reason is recorded.

### The three sub-outcomes

```ts
// core/lib/processor.ts:259-303
const prev = previousPhase(pipeline, phase.id);

if (nextGateRetryCount < max && prev) {
  // Rewind to the previous phase so it can re-produce the artifact this
  // gate checks (e.g. regenerate drafts after slop-check failure). ...
  await updateTask(task.id, {
    status: "pending",
    phaseId: prev,
    retryCount: 0,
    gateFailReason: "",
    input: {
      ...(fresh?.input ?? task.input),
      gateRetryCount: nextGateRetryCount,
      gateRetryFeedback: result.reason,
    },
  });
  await clearFailureAttempts(task.id);
  ...
} else if (nextGateRetryCount < max) {
  // No previous phase to rewind to — fall back to the legacy in-place retry ...
  await updateTask(task.id, { status: "pending", retryCount: nextGateRetryCount, gateFailReason: result.reason });
  ...
} else {
  if (phase.onExhausted) {
    try {
      await phase.onExhausted(fresh ?? task, result.reason ?? "");
    } catch (err) {
      ...
      // logged, swallowed
    }
  }
  await updateTask(task.id, { status: "needs_review", gateFailReason: result.reason });
  ...
}
```

**(a) Rewind** — budget left **and** there is a previous phase. This is the main path. The *same task* is sent back to `previousPhase`, set `pending`, with:

- `input.gateRetryCount` bumped (the budget),
- `input.gateRetryFeedback` = the gate's reason (so the upstream phase knows *why* it's regenerating),
- `gateFailReason` cleared, `retryCount` reset to 0.

Then `clearFailureAttempts` removes the `gate_fail`/`error` noise so the Failures panel shows only the live attempt. The previous phase (typically `auto_pass`) re-runs, re-produces the artifact, and auto-flows forward back into this gate on a later tick.

**(b) In-place retry** — budget left but **no** previous phase (a hypothetical first-phase deterministic gate). Legacy behavior: just re-queue `pending`, bump `task.retryCount`, store the reason in `gateFailReason`. The gate re-runs against the same input next tick. This is the *only* place `task.retryCount` is used as a gate counter.

**(c) Exhaustion** — budget spent. Fire `onExhausted(task, reason)` if defined (a cleanup hook — e.g. delete the failing draft so it can't be mistaken for good output). **Its throw is caught and logged; the transition happens regardless.** Then set `needs_review` with `gateFailReason` set. The task is now parked, and its `gateFailReason` is the flag that blocks `approveTask` (below).

---

## The rewind design, explained

This is the cleverest and most error-prone part of the runtime. Take the time to internalize it.

### Why the budget lives in `input.gateRetryCount`, not `task.retryCount`

A deterministic gate typically checks an artifact produced **upstream**. Example (marketing): a `generate` phase writes drafts; a later `slop-check` phase's gate validates them. When the gate fails, you don't want to re-check the *same* drafts three times — that fails identically three times. You want to **regenerate** the drafts. So the rewind sends the task back to `generate`.

But here's the trap: advancing forward (`advanceOrComplete`) **creates a brand-new child task** at the next phase. If the retry counter lived on `task.retryCount`, the round-trip — gate-fail → rewind to generate → advance forward → arrive back at the gate — could lose the count, because the "task at the gate" might be a different task object/record than the one that bumped the counter, depending on the pipeline shape.

By carrying the counter inside `input` (`input.gateRetryCount`), it rides along through `updateTask` (rewind keeps `input`) and through `createTask` on advance (the child's `input` is `{ ...parent.input, ...output, ... }`, so it inherits `gateRetryCount`). The budget survives the loop. **This is the load-bearing reason `input.gateRetryCount` exists.**

> **Goodbye note:** If you ever "simplify" this to use `task.retryCount` for the deterministic gate, you will get infinite (or off-by-N) retry loops on any pipeline where the gate isn't the first phase. The comment at `processor.ts:242-246` is there for exactly this reason — heed it.

### How the failure reason flows back upstream

`gateRetryFeedback: result.reason` is written into the rewound task's `input`. The upstream regenerating phase reads `task.input.gateRetryFeedback` (it's just a field on `input`) and can feed it into its Claude prompt: *"last time the slop gate complained about X — avoid that."* This closes the loop: the gate's complaint becomes the next generation's instruction. Core only *carries* the feedback; the pipeline's `run()` decides whether/how to use it.

### Why a rewind clears failure attempts

`clearFailureAttempts` after a rewind keeps the Failures panel honest — it shows the *currently active* attempt, not every prior retry's `gate_fail` entries. The `ok` attempts (the audit trail of what actually ran) are preserved.

---

## `approveTask` blocks bypassing a failed hard gate

```ts
// core/lib/processor.ts:388-392
if (phase.gateType === "deterministic" && task.gateFailReason) {
  ...
  throw new Error(`cannot approve past failed ${phase.id} gate — rerun the gate or reject the task`);
}
```

When a deterministic gate exhausts, the task is `needs_review` **with `gateFailReason` set**. A captain looking at the queue might be tempted to just click "approve". This guard refuses: approving would advance output the gate explicitly judged unfit. The captain's only sanctioned moves are:

- **fix the upstream artifact + `rerunGate`** (re-run the gate with a fresh budget), or
- **`rejectTask`** (give up on this task).

So `gateFailReason` does double duty: it's the visible reason *and* the lock that prevents bypassing a hard gate.

---

## `rerunGate` — give an exhausted gate a fresh budget

```ts
// core/lib/processor.ts:459-497 (excerpt)
if (task.status !== "needs_review") return task;
if (!task.gateFailReason) return task; // not a gate-exhausted task — refuse

const pipeline = getPipeline(task.pipelineId);
const prev = pipeline ? previousPhase(pipeline, task.phaseId) : null;
const targetPhase = prev ?? task.phaseId;

await updateTask(task.id, {
  status: "pending",
  phaseId: targetPhase,
  retryCount: 0,
  gateFailReason: "",
});
await clearFailureAttempts(task.id);
```

Only acts on a gate-exhausted task (`needs_review` + `gateFailReason`). It **rewinds to the previous phase** rather than re-checking in place, for two reasons stated in the code:

1. Re-running the gate against the same unchanged artifact fails identically.
2. `onExhausted` may have **deleted** the failing artifact, so there's nothing left to check — the upstream phase must regenerate it.

Note `rerunGate` clears `gateFailReason` but does **not** reset `input.gateRetryCount`. So the fresh budget on a rerun comes from the *rewind* path re-entering the gate; if the underlying problem persists, the budget picks up where it left off. If you want a truly fresh budget after a rerun, you'd also clear `input.gateRetryCount` — today it isn't cleared here. (Worth knowing if a rerun "uses up" retries faster than expected.)

---

## Good vs. bad: a quick reference

**Good (the design as intended):**
- Gate reason → `gateRetryFeedback` → upstream prompt → better artifact. The system self-corrects.
- Budget in `input` survives advance/rewind round-trips.
- `onExhausted` deletes bad artifacts so half-finished output never escapes.
- Hard gates can't be approved past — quality is enforced, not advisory.

**Bad (anti-patterns to avoid):**
- Putting the deterministic-gate budget on `task.retryCount` → loop bugs (see above).
- A `deterministic` phase with no `check` → instant `fail`.
- Relying on `onExhausted` not to throw → it can throw; the transition still proceeds, so don't put correctness-critical logic that *must* succeed in there.
- Expecting `approveTask` to push a gate-failed task forward → it throws; use `rerunGate` or `rejectTask`.

---

## Where gates are actually used

Deterministic gates with slop checks live in the **marketing** and **reddit-pmf** pipelines, which build their `check()` on top of the [slop engine](08-slop-engine.md). See [`../pipelines/00-index.md`](../pipelines/00-index.md) for the per-pipeline phase tables.

---

## Where to go next

- [03-processor.md](03-processor.md) — the tick that calls `applyGate`.
- [08-slop-engine.md](08-slop-engine.md) — how `check()` is implemented for slop gates.
- [02-task-lifecycle.md](02-task-lifecycle.md) — the gate transitions in the larger state machine.
