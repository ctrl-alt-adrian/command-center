import { execFile } from "child_process";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

/** Thrown when the Claude CLI reports a rate-limit / overload. The processor
 * catches this and requeues the task back to `pending` so the next tick retries. */
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

export interface ClaudeOptions {
  model?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  settingSources?: "project" | "user" | "all";
}

/** Run `claude -p` with the given prompt on stdin. Returns trimmed stdout.
 * Second arg can be a model string (back-compat) or a full options object. */
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

/** Run a slash command — same as claude() but conventionally the prompt is `/slash-name args`. */
export function claudeSlash(slashCommand: string, body: string, opts: ClaudeOptions = {}): Promise<string> {
  return claude(`${slashCommand}\n\n${body}`, opts);
}
