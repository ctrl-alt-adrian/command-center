import fs from "fs/promises";
import path from "path";
import { ERRORS_LOG } from "./paths.ts";
import { generateId, errorMessage } from "./utils.ts";

export interface PipelineError {
  id: string;
  ts: string;
  source: string;
  taskId?: string;
  stage?: string;
  message: string;
  stack?: string;
}

const MAX_ENTRIES = 500;

async function readAll(): Promise<PipelineError[]> {
  try {
    const raw = await fs.readFile(ERRORS_LOG, "utf-8");
    const out: PipelineError[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as PipelineError);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function writeAll(entries: PipelineError[]): Promise<void> {
  await fs.mkdir(path.dirname(ERRORS_LOG), { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
  await fs.writeFile(ERRORS_LOG, content, "utf-8");
}

export async function logError(
  source: string,
  err: unknown,
  ctx: { taskId?: string; stage?: string } = {}
): Promise<void> {
  try {
    const entry: PipelineError = {
      id: generateId(),
      ts: new Date().toISOString(),
      source,
      taskId: ctx.taskId,
      stage: ctx.stage,
      message: errorMessage(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    console.error(
      `[pipeline-error] ${source}${ctx.taskId ? ` task=${ctx.taskId}` : ""}${ctx.stage ? ` stage=${ctx.stage}` : ""}: ${entry.message}`
    );
    await fs.mkdir(path.dirname(ERRORS_LOG), { recursive: true });
    await fs.appendFile(ERRORS_LOG, JSON.stringify(entry) + "\n", "utf-8");
    // Probabilistic prune — keeps file from growing unbounded without hitting every write
    if (Math.random() < 0.1) {
      const all = await readAll();
      if (all.length > MAX_ENTRIES) {
        await writeAll(all.slice(-MAX_ENTRIES));
      }
    }
  } catch {
    // logError must never throw
  }
}

export async function getRecentErrors(limit = 50): Promise<PipelineError[]> {
  const all = await readAll();
  return all.slice(-limit).reverse();
}

export async function clearErrors(ids?: string[]): Promise<number> {
  if (!ids || ids.length === 0) {
    const all = await readAll();
    await writeAll([]);
    return all.length;
  }
  const all = await readAll();
  const remove = new Set(ids);
  const remaining = all.filter((e) => !remove.has(e.id));
  await writeAll(remaining);
  return all.length - remaining.length;
}
