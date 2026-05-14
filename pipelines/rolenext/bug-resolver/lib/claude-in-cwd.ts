import { execFile } from "child_process";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export interface ClaudeInCwdOptions {
  cwd: string;
  model?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  settingSources?: "project" | "user" | "all";
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

/**
 * Run `claude -p` from a specific working directory and return stdout.
 *
 * This is a per-pipeline wrapper over `claude -p` that adds `cwd` support so
 * agents (investigate, fix) can operate from inside a git worktree without
 * modifying the shared `core/lib/claude.ts` wrapper.
 */
export function claudeInCwd(prompt: string, opts: ClaudeInCwdOptions): Promise<string> {
  const model = opts.model ?? "claude-sonnet-4-6";
  const settingSources = opts.settingSources ?? "project";
  return new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      ["-p", "--setting-sources", settingSources, "--model", model],
      {
        cwd: opts.cwd,
        maxBuffer: opts.maxBuffer ?? DEFAULT_MAX_BUFFER,
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        encoding: "utf-8",
        env: cleanEnv(),
      },
      (error, stdout, stderr) => {
        if (error) {
          const parts = [`claude -p (cwd ${opts.cwd}, model ${model}) failed`];
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
