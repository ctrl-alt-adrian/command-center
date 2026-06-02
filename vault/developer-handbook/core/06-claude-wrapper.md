# Core 06 — The Claude Wrapper (`core/lib/claude.ts`)

Every pipeline that talks to an LLM does it through this one module. `claude.ts` shells out to the `claude` CLI (`claude -p`), feeds the prompt on **stdin**, returns trimmed stdout, bounds concurrency with a semaphore, and distinguishes rate-limit errors so the [processor](03-processor.md) can requeue instead of fail. It is small, and you should know it cold — if Claude assistance disappears, this is the seam where your code meets the model.

> Prereqs: a working `claude` CLI on `PATH`. This module does **not** use the Anthropic HTTP API or `@anthropic-ai/sdk` — it spawns the local `claude` binary. See the Node [`child_process.execFile`](https://nodejs.org/api/child_process.html) docs for the underlying call.

---

## Constants

```ts
// core/lib/claude.ts:1-4
import { execFile } from "child_process";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
```

- `DEFAULT_TIMEOUT_MS = 120_000` — 120 seconds per `claude` invocation. **This is the only timeout in the whole runtime.** (It is a *local* constant, independent of the equally-valued `DEFAULT_TIMEOUT_MS` exported from [`types.ts`](01-data-model.md) — they are not linked.)
- `DEFAULT_MAX_BUFFER = 10 * 1024 * 1024` — 10 MB cap on captured stdout/stderr. Exceeding it makes `execFile` error (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`).

---

## `cleanEnv()` — don't let nested Claude think it's inside Claude Code

```ts
// core/lib/claude.ts:6-11
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}
```

When the runtime itself is launched from inside Claude Code, the environment carries `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT`. If those leaked into the child `claude -p` process, the nested CLI would behave as though it were running *inside* a Claude Code session (wrong mode, wrong settings). Stripping them makes the subprocess a clean, top-level `claude` invocation. Every spawn uses `env: cleanEnv()`.

> **Goodbye note:** If you ever see the nested `claude` calls behaving strangely (picking up the parent session's context, refusing to run, etc.), this function is the first place to look. Don't remove the deletes.

---

## `RateLimitError` and `isRateLimitText`

```ts
// core/lib/claude.ts:13-32
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

function isRateLimitText(s: string): boolean {
  const t = s.toLowerCase();
  return (
    t.includes("rate limit") ||
    t.includes("rate_limit") ||
    t.includes("429") ||
    t.includes("too many requests") ||
    t.includes("overloaded") ||
    t.includes("quota exceeded")
  );
}
```

`isRateLimitText` is a substring sniff over the CLI's (lower-cased) stderr/stdout. The patterns it matches:

- `rate limit`
- `rate_limit`
- `429`
- `too many requests`
- `overloaded`
- `quota exceeded`

When any matches an *errored* invocation, the wrapper throws `RateLimitError` instead of a plain `Error`. The processor's `runPhase` catches `RateLimitError` specifically and **requeues the task to `pending`** (no failure) so a later tick retries once the limit clears — see [03-processor.md](03-processor.md) and [02-task-lifecycle.md](02-task-lifecycle.md).

> This is a heuristic, not a protocol. If Anthropic changes the wording of rate-limit messages, add the new phrase here or rate-limited runs will start hard-failing instead of requeueing.

---

## The concurrency semaphore

```ts
// core/lib/claude.ts:34-62
const CLAUDE_CONCURRENCY = (() => {
  const raw = process.env.CLAUDE_CONCURRENCY;
  if (!raw) return 8;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
})();

let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  return new Promise((res) => {
    if (active < CLAUDE_CONCURRENCY) {
      active++;
      res();
    } else {
      waiters.push(() => {
        active++;
        res();
      });
    }
  });
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}
```

A classic counting semaphore. `CLAUDE_CONCURRENCY` (env var, default **8**, must parse to a positive integer or it falls back to 8) bounds how many `claude` subprocesses run at once. `acquire()` resolves immediately if there's a free slot, otherwise it queues a resolver in `waiters`; `release()` decrements and wakes the next waiter (FIFO).

**This — not the per-tick cap — is what actually limits Anthropic API concurrency.** The processor's `Promise.all` may *start* many phases at once, but each one that calls `claude()` blocks on `acquire()` until a slot frees. The two limits compose: per-tick cap bounds tasks dispatched, `CLAUDE_CONCURRENCY` bounds simultaneous model calls.

> **Process-global semaphore caveat:** `active`/`waiters` are module-level singletons. They bound concurrency *within a single Node process*. If you run multiple processes (e.g. a separate worker), each has its own semaphore and the effective concurrency multiplies. Today the runtime is single-process (the dashboard server), so this is fine — but know it before scaling out.

---

## `ClaudeOptions` and `claude()`

```ts
// core/lib/claude.ts:64-117
export interface ClaudeOptions {
  model?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  settingSources?: "project" | "user" | "all";
}

export async function claude(prompt: string, opts: ClaudeOptions | string = {}): Promise<string> {
  await acquire();
  try {
    const resolved: ClaudeOptions = typeof opts === "string" ? { model: opts } : opts;
    const model = resolved.model ?? "claude-sonnet-4-6";
    const settingSources = resolved.settingSources ?? "project";
    return await new Promise<string>((resolve, reject) => {
      const child = execFile(
        "claude",
        ["-p", "--setting-sources", settingSources, "--model", model],
        {
          maxBuffer: resolved.maxBuffer ?? DEFAULT_MAX_BUFFER,
          timeout: resolved.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          encoding: "utf-8",
          env: cleanEnv(),
        },
        (error, stdout, stderr) => {
          if (error) {
            const cleanStderr = (stderr || "").trim();
            const cleanStdout = (stdout || "").trim();
            if (isRateLimitText(cleanStderr) || isRateLimitText(cleanStdout)) {
              const detail = cleanStderr || cleanStdout || "rate limited";
              reject(new RateLimitError(`claude -p rate limited — ${detail.slice(0, 200)}`));
              return;
            }
            const parts = [`claude -p --model ${model} failed`];
            if (error.code) parts.push(`exit ${error.code}`);
            if (error.signal) parts.push(`signal ${error.signal}`);
            if (error.killed) parts.push("(killed by timeout)");
            if (cleanStderr) parts.push(`stderr: ${cleanStderr}`);
            reject(new Error(parts.join(" — ")));
          } else {
            resolve((stdout as string).trim());
          }
        },
      );
      if (child.stdin) {
        child.stdin.write(prompt);
        child.stdin.end();
      }
    });
  } finally {
    release();
  }
}
```

### The exact invocation

```
claude -p --setting-sources <settingSources> --model <model>
```

with the **prompt written to stdin** (`child.stdin.write(prompt); child.stdin.end()`), not as an argv argument. Writing to stdin avoids shell-escaping and argv-length limits for large prompts.

### Defaults and options

| Option | Default | Flag/usage |
| --- | --- | --- |
| `model` | `"claude-sonnet-4-6"` | `--model <model>` |
| `settingSources` | `"project"` | `--setting-sources <...>` (one of `"project" \| "user" \| "all"`) |
| `timeoutMs` | `DEFAULT_TIMEOUT_MS` (120 000) | `execFile` `timeout` — on timeout the child is killed (`error.killed`) |
| `maxBuffer` | `DEFAULT_MAX_BUFFER` (10 MB) | `execFile` `maxBuffer` |

The second argument is **overloaded** for back-compat: pass a plain string and it's treated as the model (`{ model: opts }`); pass an object for full control.

```ts
// core/lib/claude.ts:76
const resolved: ClaudeOptions = typeof opts === "string" ? { model: opts } : opts;
```

### Lifecycle

1. `acquire()` a semaphore slot (may wait).
2. Spawn `claude -p ...` with `cleanEnv()`.
3. Write the prompt to stdin, end it.
4. On success: resolve with **trimmed** stdout.
5. On error: if it looks like a rate limit (stderr or stdout), throw `RateLimitError`; otherwise throw a formatted `Error`.
6. `finally` → `release()` the slot (always, even on throw).

### Error formatting

A non-rate-limit failure produces a message like:

```
claude -p --model claude-sonnet-4-6 failed — exit 1 — (killed by timeout) — stderr: <trimmed stderr>
```

Each part is conditional: exit code (`error.code`), signal (`error.signal`), the literal `(killed by timeout)` when `error.killed` is true, and the trimmed stderr if present. This message becomes the task's `error` and the `error`-outcome attempt reason. Rate-limit detail is sliced to 200 chars.

---

## `claudeSlash()`

```ts
// core/lib/claude.ts:119-122
export function claudeSlash(slashCommand: string, body: string, opts: ClaudeOptions = {}): Promise<string> {
  return claude(`${slashCommand}\n\n${body}`, opts);
}
```

A thin convenience: prepends the slash command and a blank line to the body, then calls `claude()`. So `claudeSlash("/summarize", text)` sends a prompt whose first line is `/summarize` and whose rest is `text`. This is how pipelines invoke project slash commands. (Recall from [01-data-model.md](01-data-model.md) that `PhaseConfig.slashCommand` is **not** read by core — a phase chooses its slash command by what it passes to `claudeSlash` here.)

---

## Practical notes for running solo

- **Where settings come from:** `--setting-sources project` means the child `claude` reads the *project's* settings (e.g. `.claude/`), not your user-global config. Change to `"user"` or `"all"` per-call if a phase needs user settings. This is a deliberate isolation choice.
- **Model pinning:** the default model string is a literal in this file. If a model id is retired, update `claude.ts:77` (and any pipeline that passes an explicit model).
- **Timeouts manifest as failures:** a phase that runs longer than 120 s is killed and surfaces as a `failed` task with `(killed by timeout)` in the error. Pass a larger `timeoutMs` for known-slow phases.
- **No retry inside the wrapper:** `claude()` never retries on its own. Retries are a *gate*/*processor* concern (rate-limit requeue, deterministic-gate budget) — see [04-gates.md](04-gates.md).

---

## Where to go next

- [03-processor.md](03-processor.md) — how `RateLimitError` is caught and requeued.
- [04-gates.md](04-gates.md) — the retry/rewind logic above the model call.
- [`../pipelines/00-index.md`](../pipelines/00-index.md) — pipelines that call `claude`/`claudeSlash` from their `run()`.
