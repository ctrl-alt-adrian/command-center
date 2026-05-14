import { spawn } from "child_process";

const CI_TIMEOUT_MS = 20 * 60_000;
const TAIL_BYTES = 64 * 1024;

export interface MakeCiResult {
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdoutTail: string;
  stderrTail: string;
  durationMs: number;
}

function tail(buf: string, n: number): string {
  if (buf.length <= n) return buf;
  return "... (truncated) ...\n" + buf.slice(buf.length - n);
}

/**
 * Run `make ci` in the worktree.
 * Returns exit code + tail of stdout/stderr (cap to 64 KB each).
 */
export function runMakeCi(cwd: string, target = "ci"): Promise<MakeCiResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("make", [target], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }, CI_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
      if (stdout.length > 4 * TAIL_BYTES) stdout = stdout.slice(-2 * TAIL_BYTES);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
      if (stderr.length > 4 * TAIL_BYTES) stderr = stderr.slice(-2 * TAIL_BYTES);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const exitCode = code;
      resolve({
        ok: !timedOut && exitCode === 0,
        exitCode,
        signal,
        stdoutTail: tail(stdout, TAIL_BYTES),
        stderrTail: tail(stderr, TAIL_BYTES),
        durationMs: Date.now() - started,
      });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        signal: null,
        stdoutTail: tail(stdout, TAIL_BYTES),
        stderrTail: tail(stderr, TAIL_BYTES),
        durationMs: Date.now() - started,
      });
    });
  });
}
