import { execFile } from "child_process";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

export interface ClaudeOptions {
  model?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  settingSources?: "project" | "user" | "all";
}

/** Run `claude -p` with the given prompt on stdin. Returns trimmed stdout.
 * Second arg can be a model string (back-compat) or a full options object. */
export function claude(prompt: string, opts: ClaudeOptions | string = {}): Promise<string> {
  const resolved: ClaudeOptions = typeof opts === "string" ? { model: opts } : opts;
  const model = resolved.model ?? "claude-sonnet-4-6";
  const settingSources = resolved.settingSources ?? "project";
  return new Promise((resolve, reject) => {
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
          const parts = [`claude -p --model ${model} failed`];
          if (error.code) parts.push(`exit ${error.code}`);
          if (error.signal) parts.push(`signal ${error.signal}`);
          if (error.killed) parts.push("(killed by timeout)");
          const cleanStderr = (stderr || "").trim();
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
}

/** Run a slash command — same as claude() but conventionally the prompt is `/slash-name args`. */
export function claudeSlash(slashCommand: string, body: string, opts: ClaudeOptions = {}): Promise<string> {
  return claude(`${slashCommand}\n\n${body}`, opts);
}
